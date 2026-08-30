const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password12', 'password123', 'passw0rd',
    '123456', '1234567', '12345678', '123456789', '1234567890',
    'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin',
    'iloveyou', 'monkey', 'dragon', 'login', 'master', 'masterpassword',
    'trustno1', 'sunshine', 'princess', 'football', 'baseball',
    '111111', '000000', '654321', '1q2w3e4r', 'qwertyuiop',
    'vault', 'vault123', 'changeme', 'secret', 'secret123'
]);

/**
 * Scores a master password. Passphrases of 16+ with a space are allowed
 * without mixed character classes.
 * @param {string} password
 * @returns {{ok: boolean, score: number, message: string}}
 */
export function evaluateMasterPassword(password) {
    if (!password) {
        return { ok: false, score: 0, message: 'Enter a master password.' };
    }

    const issues = [];
    if (password.length < 12) {
        issues.push('Use at least 12 characters.');
    }

    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower)) {
        issues.push('This password is too common.');
    }

    if (/^(.)\1+$/.test(password)) {
        issues.push('Do not repeat a single character.');
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const classes = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    const passphrase = password.length >= 16 && hasLower && password.includes(' ');

    if (!passphrase && password.length >= 12 && classes < 3) {
        issues.push('Mix upper, lower, numbers, or symbols — or use a 16+ character phrase.');
    }

    let score = 0;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (classes >= 3 || passphrase) score += 1;
    if ((classes >= 4 && password.length >= 12) || password.length >= 20) score += 1;
    if (issues.length) score = Math.min(score, 1);

    const ok = issues.length === 0 && password.length >= 12 && (classes >= 3 || passphrase);
    const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

    return {
        ok,
        score: Math.max(0, Math.min(4, score)),
        message: issues[0] || labels[Math.max(0, Math.min(4, score))]
    };
}

export function unlockBackoffMs(failedAttempts) {
    if (failedAttempts < 3) return 0;
    return Math.min(15000, 1000 * (2 ** (failedAttempts - 3)));
}

/**
 * Accepts only http(s) URLs. Bare hosts become https://host.
 * @param {string} raw
 * @returns {string|null}
 */
export function sanitizeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.href;
    } catch (e) {
        return null;
    }
}

export function isValidVaultExport(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
    const meta = json.meta;
    if (!meta || typeof meta !== 'object') return false;
    if (typeof meta.salt !== 'string' || !meta.salt) return false;
    if (!meta.validation || typeof meta.validation.ciphertext !== 'string' || typeof meta.validation.iv !== 'string') {
        return false;
    }
    if (meta.kdf && meta.kdf.name && meta.kdf.name !== 'PBKDF2') return false;
    if (!Array.isArray(json.items)) return false;

    return json.items.every((item) => (
        item
        && typeof item === 'object'
        && typeof item.id === 'string'
        && item.id
        && item.data
        && typeof item.data.ciphertext === 'string'
        && typeof item.data.iv === 'string'
    ));
}

export const RESET_CONFIRM_PHRASE = 'DELETE';
export const CLIPBOARD_CLEAR_MS = 30000;
export const HIDDEN_LOCK_MS = 30000;
export const INACTIVITY_LOCK_MS = 120000;
