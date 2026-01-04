const ALGORITHM = { name: 'AES-GCM', length: 256 };
const KEY_DERIVATION_ALGORITHM = { name: 'PBKDF2' };
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;

/**
 * Generates random values for salt or IV.
 * @param {number} length 
 * @returns {Uint8Array}
 */
export function getRandomValues(length) {
    return window.crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derives a cryptographic key from a password and salt.
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt) {
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
            iterations: ITERATIONS,
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
 * @returns {Promise<{ciphertext: Uint8Array, iv: Uint8Array}>}
 */
export async function encrypt(text, key) {
    const iv = getRandomValues(12); // 96-bit IV for AES-GCM
    const enc = new TextEncoder();
    const encoded = enc.encode(text);

    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encoded
    );

    return {
        ciphertext: new Uint8Array(ciphertext),
        iv: iv
    };
}

/**
 * Decrypts data.
 * @param {Uint8Array} ciphertext 
 * @param {Uint8Array} iv 
 * @param {CryptoKey} key 
 * @returns {Promise<string>}
 */
export async function decrypt(ciphertext, iv, key) {
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (e) {
        throw new Error('Decryption failed');
    }
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
