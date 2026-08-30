import * as Crypto from './crypto.js';
import { Storage } from './storage.js';
import { UI } from './ui.js';
import { FileSystem } from './file-system.js';
import { DB } from './db.js';
import {
    evaluateMasterPassword,
    unlockBackoffMs,
    isValidVaultExport,
    RESET_CONFIRM_PHRASE,
    HIDDEN_LOCK_MS,
    INACTIVITY_LOCK_MS
} from './security.js';

// State
let STATE = {
    key: null, // CryptoKey
    items: [], // Decrypted items in memory
    isNewUser: false,
    syncHandle: null
};

let failedUnlocks = 0;
let unlockBlockedUntil = 0;
let inactivityTimer = null;
let hiddenTimer = null;

// Initialization
async function init() {
    const meta = Storage.getMeta();
    if (!meta) {
        STATE.isNewUser = true;
        UI.authView.querySelector('h1').textContent = 'Create Vault';
        UI.authView.querySelector('p').textContent = 'Set a master password to secure your data.';

        const warningEl = UI.authView.querySelector('.small-text') || UI.authView.querySelector('.funny-warning');
        warningEl.className = 'funny-warning';
        warningEl.textContent = 'Tattoo this on your brain! If you lose it, your data becomes digital confetti. Unrecoverable, sad confetti. 🎊➡️🗑️😭';

        UI.unlockBtn.textContent = 'Create Vault';
        UI.masterPasswordInput.setAttribute('autocomplete', 'new-password');
        document.getElementById('confirm-password-group').classList.remove('hidden');
        document.getElementById('password-strength').classList.remove('hidden');
    } else {
        STATE.isNewUser = false;
        UI.authView.querySelector('h1').textContent = 'Unlock Vault';
        UI.authView.querySelector('p').textContent = 'Enter your master password to access your secure data.';
        UI.authView.querySelector('.small-text').textContent = '';
        UI.unlockBtn.textContent = 'Unlock';
        UI.masterPasswordInput.setAttribute('autocomplete', 'current-password');

        const resetBtn = document.getElementById('reset-vault-btn');
        if (resetBtn) resetBtn.classList.remove('hidden');
    }

    setupEventListeners();
    setupAutoLock();
    checkSyncStatus();
}

function renderSyncBadge(handle, hasPerm) {
    const info = document.getElementById('sync-info');
    if (!info) return;

    const savedLabel = localStorage.getItem('vault_sync_path_label');
    const displayLabel = savedLabel || handle.name;

    info.replaceChildren();
    if (savedLabel) {
        info.appendChild(document.createTextNode('📍 '));
    } else {
        const prefix = document.createElement('span');
        prefix.className = 'path-prefix';
        prefix.textContent = '📂 / ... / ';
        info.appendChild(prefix);
    }
    info.appendChild(document.createTextNode(displayLabel));
    if (!hasPerm) {
        info.appendChild(document.createTextNode(' (Disconnected)'));
    }

    info.classList.remove('hidden');
    info.title = 'Browser security hides the real path. Click to manually add the full path label.';

    info.onclick = async () => {
        const current = localStorage.getItem('vault_sync_path_label') || '';
        const newPath = prompt('Browsers hide the full file path for security.\n\nTo remember where this file is, paste the full path here as a label:', current);
        if (newPath !== null) {
            localStorage.setItem('vault_sync_path_label', newPath);
            checkSyncStatus();
        }
    };
}

async function checkSyncStatus() {
    const handle = await FileSystem.getStoredHandle();
    const btn = document.getElementById('sync-btn');
    const info = document.getElementById('sync-info');

    if (handle) {
        STATE.syncHandle = handle;
        const hasPerm = await FileSystem.verifyPermission(handle, false);

        renderSyncBadge(handle, hasPerm);

        btn.classList.remove('synced', 'warn');
        if (hasPerm) {
            btn.textContent = '📂 Synced';
            btn.classList.add('synced');
            btn.title = `Synced with: ${handle.name}`;
            if (info) {
                info.classList.add('active');
                info.classList.remove('disconnected');
            }
        } else {
            btn.textContent = '⚠️ Reconnect';
            btn.classList.add('warn');
            btn.title = 'Click to reconnect sync';
            if (info) {
                info.classList.add('disconnected');
                info.classList.remove('active');
            }
        }
    } else {
        btn.textContent = '📂 File Sync';
        btn.classList.remove('synced', 'warn');
        if (info) info.classList.add('hidden');
    }
}

function scheduleInactivityLock() {
    clearTimeout(inactivityTimer);
    if (!STATE.key) return;
    inactivityTimer = setTimeout(() => lockVault(), INACTIVITY_LOCK_MS);
}

function setupAutoLock() {
    window.addEventListener('mousemove', scheduleInactivityLock);
    window.addEventListener('keydown', scheduleInactivityLock);
    window.addEventListener('click', scheduleInactivityLock);
    window.addEventListener('scroll', scheduleInactivityLock);

    document.addEventListener('visibilitychange', () => {
        clearTimeout(hiddenTimer);
        if (!STATE.key) return;
        if (document.hidden) {
            hiddenTimer = setTimeout(() => lockVault(), HIDDEN_LOCK_MS);
        } else {
            scheduleInactivityLock();
        }
    });
}

function lockVault() {
    STATE.key = null;
    STATE.items = [];
    location.reload();
}

function showAuthError(message) {
    UI.authError.textContent = message;
    UI.authError.classList.remove('hidden');
}

function resetUnlockButton() {
    UI.unlockBtn.disabled = false;
    UI.unlockBtn.textContent = STATE.isNewUser ? 'Create Vault' : 'Unlock';
}

function setupEventListeners() {
    UI.unlockBtn.addEventListener('click', handleAuth);
    UI.masterPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAuth();
    });
    if (UI.masterPasswordConfirm) {
        UI.masterPasswordConfirm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAuth();
        });
    }
    UI.masterPasswordInput.addEventListener('input', () => {
        if (!STATE.isNewUser) return;
        UI.setPasswordStrength(evaluateMasterPassword(UI.masterPasswordInput.value));
    });

    const resetBtn = document.getElementById('reset-vault-btn');
    const resetInput = document.getElementById('reset-confirm-input');
    const confirmResetBtn = document.getElementById('confirm-reset-btn');
    const cancelResetBtn = document.getElementById('cancel-reset-btn');

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (resetInput) resetInput.value = '';
            if (confirmResetBtn) confirmResetBtn.disabled = true;
            UI.show(UI.resetModal);
            if (resetInput) resetInput.focus();
        });
    }

    if (resetInput && confirmResetBtn) {
        resetInput.addEventListener('input', () => {
            confirmResetBtn.disabled = resetInput.value.trim() !== RESET_CONFIRM_PHRASE;
        });
        confirmResetBtn.addEventListener('click', async () => {
            if (resetInput.value.trim() !== RESET_CONFIRM_PHRASE) return;
            Storage.clear();
            await DB.clear();
            localStorage.removeItem('vault_sync_path_label');
            location.reload();
        });
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', () => UI.hide(UI.resetModal));
    }

    UI.lockBtn.addEventListener('click', lockVault);

    UI.addItemBtn.addEventListener('click', openAddItemModal);

    UI.cancelModalBtn.addEventListener('click', () => UI.hide(UI.itemModal));
    UI.itemForm.addEventListener('submit', handleSaveItem);

    const typeSelect = document.getElementById('item-type');
    typeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'password') {
            document.getElementById('password-fields').classList.remove('hidden');
            document.getElementById('card-fields').classList.add('hidden');
        } else {
            document.getElementById('password-fields').classList.add('hidden');
            document.getElementById('card-fields').classList.remove('hidden');
        }
    });

    document.querySelectorAll('.toggle-visibility').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.parentElement;
            const input = wrapper.querySelector('input');
            if (input.type === 'password') {
                input.type = 'text';
                e.target.textContent = '🙈';
            } else {
                input.type = 'password';
                e.target.textContent = '👁️';
            }
        });
    });

    const genBtn = document.getElementById('generate-password-btn');
    if (genBtn) {
        genBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const password = Crypto.generateCustomPassword();
            const input = document.getElementById('item-password');
            input.value = password;
            input.type = 'text';
            const wrapper = input.parentElement;
            const toggle = wrapper.querySelector('.toggle-visibility');
            if (toggle) toggle.textContent = '🙈';
        });
    }

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderFilteredItems(e.target.dataset.filter);
        });
    });

    UI.searchInput.addEventListener('input', (e) => renderFilteredItems('all', e.target.value));

    UI.exportBtn.addEventListener('click', handleExport);

    UI.importBtn.addEventListener('click', () => UI.show(UI.importModal));
    UI.cancelImportBtn.addEventListener('click', () => UI.hide(UI.importModal));
    UI.confirmImportBtn.addEventListener('click', handleImport);

    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn && FileSystem.isSupported()) {
        syncBtn.addEventListener('click', async () => {
            if (STATE.syncHandle) {
                const granted = await FileSystem.verifyPermission(STATE.syncHandle, true);
                if (granted) {
                    UI.showToast('Sync connection re-established.');
                    checkSyncStatus();
                } else {
                    if (confirm('Permission denied. Do you want to link a new file?')) {
                        const result = await FileSystem.saveToDisk(JSON.stringify(getExportData(), null, 2), 'vault.json');
                        if (result.success) {
                            STATE.syncHandle = result.handle;
                            checkSyncStatus();
                        }
                    }
                }
            } else {
                UI.showToast('Select a location to store your synced vault file.');
                const result = await FileSystem.saveToDisk(JSON.stringify(getExportData(), null, 2), 'vault.json');
                if (result.success) {
                    STATE.syncHandle = result.handle;
                    checkSyncStatus();
                }
            }
        });
    } else if (syncBtn) {
        syncBtn.classList.add('hidden');
    }
}

async function encryptItemsForKey(items, key) {
    const stored = [];
    for (const item of items) {
        const { id, ...data } = item;
        const encrypted = await Crypto.encryptItem(data, key, id);
        stored.push({
            id,
            data: {
                ciphertext: Crypto.bufferToBase64(encrypted.ciphertext),
                iv: Crypto.bufferToBase64(encrypted.iv)
            }
        });
    }
    return stored;
}

async function rewrapVault(password) {
    const previousMeta = Storage.getMeta();
    const previousItems = Storage.getItems();
    const salt = Crypto.getRandomValues(16);
    const key = await Crypto.deriveKey(password, salt, Crypto.CURRENT_ITERATIONS);
    const validation = await Crypto.encrypt(
        Crypto.VALIDATION_PLAINTEXT,
        key,
        Crypto.VALIDATION_AAD
    );
    const stored = await encryptItemsForKey(STATE.items, key);
    const meta = Crypto.buildMeta(salt, validation, Crypto.CURRENT_ITERATIONS);
    try {
        Storage.saveItems(stored);
        Storage.setMeta(meta);
    } catch (e) {
        Storage.setMeta(previousMeta);
        Storage.saveItems(previousItems);
        throw e;
    }
    STATE.key = key;
    await autoSync();
}

async function handleAuth() {
    const password = UI.masterPasswordInput.value;
    if (!password) return;

    if (!STATE.isNewUser && Date.now() < unlockBlockedUntil) {
        const wait = Math.ceil((unlockBlockedUntil - Date.now()) / 1000);
        showAuthError(`Too many attempts. Try again in ${wait}s.`);
        return;
    }

    UI.authError.classList.add('hidden');
    UI.unlockBtn.disabled = true;
    UI.unlockBtn.textContent = 'Processing...';

    try {
        if (STATE.isNewUser) {
            const confirm = UI.masterPasswordConfirm ? UI.masterPasswordConfirm.value : '';
            const strength = evaluateMasterPassword(password);
            UI.setPasswordStrength(strength);
            if (!strength.ok) {
                showAuthError(strength.message);
                return;
            }
            if (password !== confirm) {
                showAuthError('Passwords do not match.');
                return;
            }

            const salt = Crypto.getRandomValues(16);
            const key = await Crypto.deriveKey(password, salt, Crypto.CURRENT_ITERATIONS);
            const validation = await Crypto.encrypt(
                Crypto.VALIDATION_PLAINTEXT,
                key,
                Crypto.VALIDATION_AAD
            );
            Storage.setMeta(Crypto.buildMeta(salt, validation, Crypto.CURRENT_ITERATIONS));
            Storage.saveItems([]);
            STATE.key = key;
            enterDashboard();
        } else {
            const meta = Storage.getMeta();
            const kdf = Crypto.getKdfParams(meta);
            const salt = Crypto.base64ToBuffer(meta.salt);
            const key = await Crypto.deriveKey(password, salt, kdf.iterations);

            const valParams = meta.validation;
            const strictAad = Number(meta.version) >= 2;
            let validationLegacy = false;

            if (strictAad) {
                const text = await Crypto.decrypt(
                    Crypto.base64ToBuffer(valParams.ciphertext),
                    Crypto.base64ToBuffer(valParams.iv),
                    key,
                    Crypto.VALIDATION_AAD
                );
                if (text !== Crypto.VALIDATION_PLAINTEXT) throw new Error('Invalid');
            } else {
                const unlocked = await Crypto.decryptWithLegacyFallback(
                    Crypto.base64ToBuffer(valParams.ciphertext),
                    Crypto.base64ToBuffer(valParams.iv),
                    key,
                    Crypto.VALIDATION_AAD
                );
                if (unlocked.text !== Crypto.VALIDATION_PLAINTEXT) throw new Error('Invalid');
                validationLegacy = unlocked.legacy;
            }

            failedUnlocks = 0;
            STATE.key = key;
            const itemsWereLegacy = await loadItems(strictAad);
            const needsUpgrade = validationLegacy
                || itemsWereLegacy
                || kdf.iterations < Crypto.CURRENT_ITERATIONS;

            enterDashboard();

            if (needsUpgrade) {
                try {
                    UI.showToast('Upgrading vault encryption…');
                    await rewrapVault(password);
                    UI.showToast('Vault encryption upgraded.');
                } catch (upgradeErr) {
                    console.error('Vault upgrade failed', upgradeErr);
                    UI.showToast('Could not upgrade encryption. Existing data is still usable.');
                }
            }
        }
    } catch (e) {
        const unsupported = e && (e.message === 'Unsupported KDF' || e.message === 'Unsupported KDF parameters');
        if (STATE.key) {
            showAuthError('An error occurred after unlock.');
        } else if (unsupported) {
            showAuthError('This vault uses unsupported encryption parameters.');
        } else if (!STATE.isNewUser) {
            failedUnlocks += 1;
            const delay = unlockBackoffMs(failedUnlocks);
            unlockBlockedUntil = Date.now() + delay;
            showAuthError(delay ? `Incorrect password. Try again in ${Math.ceil(delay / 1000)}s.` : 'Incorrect password.');
        } else {
            showAuthError('An error occurred.');
        }
    } finally {
        if (!STATE.key) resetUnlockButton();
    }
}

function enterDashboard() {
    UI.masterPasswordInput.value = '';
    if (UI.masterPasswordConfirm) UI.masterPasswordConfirm.value = '';
    UI.showView('dashboard');
    renderFilteredItems('all');
    scheduleInactivityLock();
}

async function loadItems(strictAad = false) {
    const encryptedItems = Storage.getItems();
    STATE.items = [];
    let legacy = false;

    for (const item of encryptedItems) {
        try {
            if (strictAad) {
                const text = await Crypto.decrypt(
                    Crypto.base64ToBuffer(item.data.ciphertext),
                    Crypto.base64ToBuffer(item.data.iv),
                    STATE.key,
                    Crypto.itemAad(item.id)
                );
                STATE.items.push({ id: item.id, ...JSON.parse(text) });
            } else {
                const result = await Crypto.decryptItem(item, STATE.key);
                if (result.legacy) legacy = true;
                STATE.items.push({
                    id: item.id,
                    ...result.data
                });
            }
        } catch (e) {
            console.error('Failed to decrypt item', item.id);
        }
    }

    return legacy;
}

function renderFilteredItems(filter, searchQuery = '') {
    let items = STATE.items;

    const activeFilter = document.querySelector('.nav-item.active').dataset.filter;
    if (activeFilter !== 'all') {
        items = items.filter(i => i.type === activeFilter);
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(q));
    }

    UI.renderItems(items, null, openEditModal, null);
}

function openAddItemModal() {
    UI.itemForm.reset();
    document.getElementById('item-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Item';

    const activeFilter = document.querySelector('.nav-item.active').dataset.filter;
    const typeSelect = document.getElementById('item-type');

    if (activeFilter === 'card') {
        typeSelect.value = 'card';
    } else {
        typeSelect.value = 'password';
    }

    const evt = new Event('change');
    typeSelect.dispatchEvent(evt);

    UI.show(UI.itemModal);
}

function openEditModal(item) {
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-type').value = item.type;
    document.getElementById('item-name').value = item.name;
    document.getElementById('modal-title').textContent = 'Edit Item';

    const evt = new Event('change');
    document.getElementById('item-type').dispatchEvent(evt);

    if (item.type === 'password') {
        document.getElementById('item-username').value = item.username || '';
        document.getElementById('item-password').value = item.password || '';
        document.getElementById('item-url').value = item.url || '';
    } else {
        document.getElementById('card-holder').value = item.cardHolder || '';
        document.getElementById('card-number').value = item.cardNumber || '';
        document.getElementById('card-expiry').value = item.cardExpiry || '';
        document.getElementById('card-cvv').value = item.cardCvv || '';
    }

    UI.show(UI.itemModal);
}

async function handleSaveItem(e) {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const type = document.getElementById('item-type').value;
    const name = document.getElementById('item-name').value;

    let data = { type, name, updatedAt: Date.now() };

    if (type === 'password') {
        data.username = document.getElementById('item-username').value;
        data.password = document.getElementById('item-password').value;
        data.url = document.getElementById('item-url').value;
    } else {
        data.cardHolder = document.getElementById('card-holder').value;
        data.cardNumber = document.getElementById('card-number').value;
        data.cardExpiry = document.getElementById('card-expiry').value;
        data.cardCvv = document.getElementById('card-cvv').value;
    }

    const itemId = id || crypto.randomUUID();
    const encrypted = await Crypto.encryptItem(data, STATE.key, itemId);

    const encryptedItem = {
        id: itemId,
        data: {
            ciphertext: Crypto.bufferToBase64(encrypted.ciphertext),
            iv: Crypto.bufferToBase64(encrypted.iv)
        }
    };

    if (id) {
        const index = STATE.items.findIndex(i => i.id === id);
        if (index !== -1) STATE.items[index] = { id, ...data };

        const storedItems = Storage.getItems();
        const storedIndex = storedItems.findIndex(i => i.id === id);
        if (storedIndex !== -1) storedItems[storedIndex] = encryptedItem;
        Storage.saveItems(storedItems);
    } else {
        STATE.items.push({ id: encryptedItem.id, ...data });

        const storedItems = Storage.getItems();
        storedItems.push(encryptedItem);
        Storage.saveItems(storedItems);
    }

    await autoSync();

    UI.hide(UI.itemModal);
    renderFilteredItems('all');
}

async function autoSync() {
    if (!STATE.syncHandle) return;
    try {
        const hasPerm = await FileSystem.verifyPermission(STATE.syncHandle, true);
        if (hasPerm) {
            await FileSystem.writeToFile(STATE.syncHandle, JSON.stringify(getExportData(), null, 2));
        } else {
            checkSyncStatus();
        }
    } catch (err) {
        console.error('Auto-sync error:', err);
    }
}

function getExportData() {
    return {
        version: 2,
        exportedAt: new Date().toISOString(),
        meta: Storage.getMeta(),
        items: Storage.getItems()
    };
}

async function handleExport() {
    const exportData = getExportData();

    const jsonStr = JSON.stringify(exportData, null, 2);
    const filename = `vault-export-${new Date().toISOString().slice(0, 10)}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function importVaultData(json) {
    if (!isValidVaultExport(json)) throw new Error('Invalid Format');

    if (confirm('This will replace your current vault. Are you sure?')) {
        Storage.setMeta(json.meta);
        Storage.saveItems(json.items);
        location.reload();
    }
}

function handleImport() {
    const fileInput = document.getElementById('import-file');
    const textarea = document.getElementById('import-data');

    if (textarea.value.trim()) {
        try {
            const json = JSON.parse(textarea.value);
            importVaultData(json);
            return;
        } catch (e) {
            alert('Invalid JSON in text area');
            return;
        }
    }

    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            importVaultData(json);
        } catch (err) {
            alert('Failed to import file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

init();
