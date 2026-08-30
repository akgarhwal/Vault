const ALGORITHM = { name: 'AES-GCM', length: 256 };
const HASH_ALGORITHM = 'SHA-256';

/** OWASP 2024+ minimum for PBKDF2-HMAC-SHA-256. */
export const CURRENT_ITERATIONS = 600000;
/** Iteration count used by vaults created before the KDF upgrade. */
export const LEGACY_ITERATIONS = 100000;
export const MAX_ITERATIONS = 2000000;
export const KDF_NAME = 'PBKDF2';
export const VALIDATION_PLAINTEXT = 'VALID';
export const VALIDATION_AAD = 'vault:validation:v1';

/**
 * Generates random values for salt or IV.
 * @param {number} length
 * @returns {Uint8Array}
 */
export function getRandomValues(length) {
    return window.crypto.getRandomValues(new Uint8Array(length));
}

export function itemAad(id) {
    return `vault:item:${id}`;
}

export function getKdfParams(meta) {
    const raw = Number(meta && meta.kdf && meta.kdf.iterations);
    if (!Number.isFinite(raw) || raw < 1) {
        return { name: KDF_NAME, hash: HASH_ALGORITHM, iterations: LEGACY_ITERATIONS };
    }
    if (raw > MAX_ITERATIONS) {
        throw new Error('Unsupported KDF parameters');
    }
    const name = (meta.kdf && meta.kdf.name) || KDF_NAME;
    if (name !== KDF_NAME) {
        throw new Error('Unsupported KDF');
    }
    return { name: KDF_NAME, hash: HASH_ALGORITHM, iterations: Math.floor(raw) };
}

export function buildMeta(salt, validation, iterations = CURRENT_ITERATIONS) {
    return {
        version: 2,
        kdf: {
            name: KDF_NAME,
            hash: HASH_ALGORITHM,
            iterations
        },
        salt: bufferToBase64(salt),
        validation: {
            ciphertext: bufferToBase64(validation.ciphertext),
            iv: bufferToBase64(validation.iv)
        }
    };
}

/**
 * Unbiased index in [0, max).
 * @param {number} max
 */
function randomIndex(max) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let value;
    do {
        window.crypto.getRandomValues(buf);
        value = buf[0];
    } while (value >= limit);
    return value % max;
}

function pickChar(charset) {
    return charset[randomIndex(charset.length)];
}

function encodeAad(aad) {
    if (!aad) return null;
    if (typeof aad === 'string') return new TextEncoder().encode(aad);
    return aad;
}

/**
 * Derives a cryptographic key from a password and salt.
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {number} [iterations]
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt, iterations = CURRENT_ITERATIONS) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: HASH_ALGORITHM
        },
        keyMaterial,
        ALGORITHM,
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a text string.
 * @param {string} text
 * @param {CryptoKey} key
 * @param {string|Uint8Array} [aad]
 * @returns {Promise<{ciphertext: Uint8Array, iv: Uint8Array}>}
 */
export async function encrypt(text, key, aad) {
    const iv = getRandomValues(12); // 96-bit IV for AES-GCM
    const enc = new TextEncoder();
    const encoded = enc.encode(text);
    const params = {
        name: 'AES-GCM',
        iv: iv
    };
    const extra = encodeAad(aad);
    if (extra) params.additionalData = extra;

    const ciphertext = await window.crypto.subtle.encrypt(
        params,
        key,
        encoded
    );

    return {
        ciphertext: new Uint8Array(ciphertext),
        iv: iv
    };
}

/**
 * Decrypts data. AAD must match what was used at encrypt time.
 * @param {Uint8Array} ciphertext
 * @param {Uint8Array} iv
 * @param {CryptoKey} key
 * @param {string|Uint8Array} [aad]
 * @returns {Promise<string>}
 */
export async function decrypt(ciphertext, iv, key, aad) {
    try {
        const params = {
            name: 'AES-GCM',
            iv: iv
        };
        const extra = encodeAad(aad);
        if (extra) params.additionalData = extra;

        const decrypted = await window.crypto.subtle.decrypt(
            params,
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (e) {
        throw new Error('Decryption failed');
    }
}

/**
 * Decrypts with AAD, then retries without AAD for pre-upgrade vaults.
 * @returns {Promise<{text: string, legacy: boolean}>}
 */
export async function decryptWithLegacyFallback(ciphertext, iv, key, aad) {
    try {
        const text = await decrypt(ciphertext, iv, key, aad);
        return { text, legacy: false };
    } catch (e) {
        const text = await decrypt(ciphertext, iv, key);
        return { text, legacy: true };
    }
}

export async function encryptItem(data, key, id) {
    return encrypt(JSON.stringify(data), key, itemAad(id));
}

export async function decryptItem(item, key) {
    const result = await decryptWithLegacyFallback(
        base64ToBuffer(item.data.ciphertext),
        base64ToBuffer(item.data.iv),
        key,
        itemAad(item.id)
    );
    return {
        data: JSON.parse(result.text),
        legacy: result.legacy
    };
}

// Helpers for buffer conversion (Base64)
export function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

/**
 * Generates a 20-character password with all character classes.
 * Uses rejection sampling so charset picking is unbiased.
 * @param {number} [length]
 * @returns {string}
 */
export function generateCustomPassword(length = 20) {
    const size = Math.max(16, length);
    const chars = {
        lower: 'abcdefghijklmnopqrstuvwxyz',
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        digits: '0123456789',
        special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    const all = chars.lower + chars.upper + chars.digits + chars.special;

    const password = [
        pickChar(chars.lower),
        pickChar(chars.upper),
        pickChar(chars.digits),
        pickChar(chars.special)
    ];

    for (let i = password.length; i < size; i++) {
        password.push(pickChar(all));
    }

    for (let i = password.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
}
