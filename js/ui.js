import { CLIPBOARD_CLEAR_MS, sanitizeHttpUrl } from './security.js';

function createEditBtn(item, onEdit) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-edit-btn';
    btn.textContent = '✏️';
    btn.title = 'Edit Details';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onEdit(item);
    });
    return btn;
}

export const UI = {
    // Views
    authView: document.getElementById('auth-view'),
    dashboardView: document.getElementById('dashboard-view'),

    // Inputs
    masterPasswordInput: document.getElementById('master-password-input'),
    masterPasswordConfirm: document.getElementById('master-password-confirm'),
    searchInput: document.getElementById('search-input'),

    // Buttons
    unlockBtn: document.getElementById('unlock-btn'),
    addItemBtn: document.getElementById('add-item-btn'),
    lockBtn: document.getElementById('lock-btn'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),

    // Modal
    itemModal: document.getElementById('item-modal'),
    importModal: document.getElementById('import-modal'),
    resetModal: document.getElementById('reset-modal'),
    itemForm: document.getElementById('item-form'),
    cancelModalBtn: document.getElementById('cancel-modal'),
    cancelImportBtn: document.getElementById('cancel-import'),
    confirmImportBtn: document.getElementById('confirm-import'),

    // Grid
    itemsGrid: document.getElementById('items-grid'),

    // Error
    authError: document.getElementById('auth-error'),

    show(element) {
        element.classList.remove('hidden');
    },

    hide(element) {
        element.classList.add('hidden');
    },

    showView(viewName) {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        if (viewName === 'auth') {
            this.authView.classList.remove('hidden');
            this.authView.classList.add('active');
        } else if (viewName === 'dashboard') {
            this.dashboardView.classList.remove('hidden');
            this.dashboardView.classList.add('active');
        }
    },

    setPasswordStrength(result) {
        const wrap = document.getElementById('password-strength');
        const label = document.getElementById('password-strength-label');
        if (!wrap || !label) return;
        wrap.dataset.score = String(result.score);
        label.textContent = result.message;
        label.classList.toggle('error-text', !result.ok);
    },

    renderItems(items, onReveal, onEdit, onDelete) {
        this.itemsGrid.textContent = '';
        items.forEach(item => {
            const card = document.createElement('div');

            if (item.type === 'card') {
                card.className = 'vault-item-card credit-card-container';

                const n = item.cardNumber || '';
                let brand = 'Card';
                if (n.startsWith('4')) brand = 'Visa';
                else if (n.startsWith('5')) brand = 'MasterCard';
                else if (n.startsWith('3')) brand = 'Amex';

                const first4 = n.slice(0, 4) || '****';
                const last4 = n.slice(-4) || '****';
                const masked = `${first4} •••• •••• ${last4}`;

                card.innerHTML = `
                    <div class="card-inner">
                        <div class="card-face card-front">
                             <div class="card-item-name"></div>
                             <div class="card-brand"></div>
                             <div class="card-chip"></div>
                             <div class="card-number-masked"></div>
                             <div class="card-footer">
                                <div class="card-holder">
                                    <span>Card Holder</span>
                                    <div class="card-holder-name"></div>
                                </div>
                                <div class="card-expiry">
                                    <span>Expires</span>
                                    <div class="card-expiry-value"></div>
                                </div>
                            </div>
                        </div>
                        <div class="card-face card-back">
                            <div class="card-strip"></div>
                            <div class="card-signature-block">
                                <div class="card-cvv-box"></div>
                            </div>
                            <div class="card-full-number">
                                <span class="card-full-number-text"></span>
                                <button type="button" class="copy-number-btn" title="Copy Number">📋</button>
                            </div>
                        </div>
                    </div>
                `;

                card.querySelector('.card-item-name').textContent = item.name || '';
                card.querySelector('.card-brand').textContent = brand;
                card.querySelector('.card-number-masked').textContent = masked;
                card.querySelector('.card-holder-name').textContent = item.cardHolder || 'NAME';
                card.querySelector('.card-expiry-value').textContent = item.cardExpiry || 'MM/YY';
                card.querySelector('.card-cvv-box').textContent = item.cardCvv || '***';
                card.querySelector('.card-full-number-text').textContent = n;

                card.querySelector('.card-front').appendChild(createEditBtn(item, onEdit));
                card.querySelector('.card-back').appendChild(createEditBtn(item, onEdit));

                card.querySelector('.copy-number-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.copyToClipboard(n, 'Card number copied. Clipboard clears in 30s.');
                });

                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });

            } else {
                card.className = 'vault-item-card credit-card-container';

                card.innerHTML = `
                    <div class="card-inner">
                        <div class="card-face card-front password-card-bg">
                             <div class="password-face-content">
                                <div class="password-front-icon">🔑</div>
                                <div class="password-front-name"></div>
                                <div class="password-front-username"></div>
                             </div>
                        </div>
                        <div class="card-face card-back password-card-bg">
                            <div class="password-back-content">
                                <div class="password-row">
                                    <div class="password-row-grow">
                                        <div class="password-row-label">Username</div>
                                        <div class="password-row-value password-username-value"></div>
                                    </div>
                                    <button type="button" class="password-action-btn btn-copy-user" title="Copy Username">👤</button>
                                </div>
                                <div class="password-row">
                                    <div class="password-row-grow">
                                        <div class="password-row-label">Password</div>
                                        <div class="password-row-value password-text"></div>
                                    </div>
                                    <div class="password-row-actions">
                                        <button type="button" class="password-action-btn btn-view-pass" title="Show/Hide">👁️</button>
                                        <button type="button" class="password-action-btn btn-copy-pass" title="Copy">📋</button>
                                    </div>
                                </div>
                                <button type="button" class="password-url-btn btn-launch">🔗 Open URL</button>
                            </div>
                        </div>
                    </div>
                `;

                card.querySelector('.password-front-name').textContent = item.name || '';
                card.querySelector('.password-front-username').textContent = item.username || '';
                card.querySelector('.password-username-value').textContent = item.username || '---';
                const passText = card.querySelector('.password-text');
                passText.textContent = item.password ? '••••••••' : '---';

                const launchBtn = card.querySelector('.btn-launch');
                if (!item.url) launchBtn.disabled = true;

                card.querySelector('.card-front').appendChild(createEditBtn(item, onEdit));
                card.querySelector('.card-back').appendChild(createEditBtn(item, onEdit));

                card.querySelector('.btn-copy-user').addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.copyToClipboard(item.username || '', 'Username copied. Clipboard clears in 30s.');
                });

                const btnViewPass = card.querySelector('.btn-view-pass');
                let isPassVisible = false;
                btnViewPass.addEventListener('click', (e) => {
                    e.stopPropagation();
                    isPassVisible = !isPassVisible;
                    if (isPassVisible) {
                        passText.textContent = item.password || '';
                        btnViewPass.textContent = '🙈';
                    } else {
                        passText.textContent = '••••••••';
                        btnViewPass.textContent = '👁️';
                    }
                });

                card.querySelector('.btn-copy-pass').addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.copyToClipboard(item.password || '', 'Password copied. Clipboard clears in 30s.');
                });

                launchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const url = sanitizeHttpUrl(item.url);
                    if (!url) {
                        UI.showToast('Blocked a non-http(s) URL.');
                        return;
                    }
                    window.open(url, '_blank', 'noopener,noreferrer');
                });

                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });
            }
            this.itemsGrid.appendChild(card);
        });
    },

    async copyToClipboard(text, message) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(message);
            const snapshot = text;
            window.setTimeout(async () => {
                try {
                    const current = await navigator.clipboard.readText();
                    if (current === snapshot) {
                        await navigator.clipboard.writeText('');
                    }
                } catch (e) {
                    // Permission to read clipboard is optional; never wipe blindly.
                }
            }, CLIPBOARD_CLEAR_MS);
        } catch (e) {
            this.showToast('Could not copy to clipboard.');
        }
    },

    showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'show';
        setTimeout(() => toast.className = toast.className.replace('show', ''), 3000);
    }
};
