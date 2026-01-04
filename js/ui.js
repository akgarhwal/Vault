export const UI = {
    // Views
    authView: document.getElementById('auth-view'),
    dashboardView: document.getElementById('dashboard-view'),

    // Inputs
    masterPasswordInput: document.getElementById('master-password-input'),
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

    renderItems(items, onReveal, onEdit, onDelete) {
        this.itemsGrid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');

            if (item.type === 'card') {
                card.className = 'vault-item-card credit-card-container';

                // Card Data
                const n = item.cardNumber || '';
                let brand = 'Card';
                if (n.startsWith('4')) brand = 'Visa';
                else if (n.startsWith('5')) brand = 'MasterCard';
                else if (n.startsWith('3')) brand = 'Amex';

                // Display Format: Single Line, Reduced Asterisks
                const first4 = n.slice(0, 4) || '****';
                const last4 = n.slice(-4) || '****';
                const masked = `${first4} •••• •••• ${last4}`;

                // Edit Button Helper
                const createEditBtn = () => {
                    const btn = document.createElement('button');
                    btn.className = 'card-edit-btn';
                    btn.innerHTML = '✏️';
                    btn.title = 'Edit Details';
                    btn.onclick = (e) => {
                        e.stopPropagation(); // Prevent flip
                        onEdit(item);
                    };
                    return btn;
                };

                const editBtnFront = createEditBtn();
                const editBtnBack = createEditBtn();

                card.innerHTML = `
                    <div class="card-inner">
                        <div class="card-face card-front">
                             <div class="card-item-name">${item.name}</div>
                             <div class="card-brand">${brand}</div>
                             <div class="card-chip"></div>
                             <div class="card-number-masked">${masked}</div>
                             <div class="card-footer">
                                <div class="card-holder">
                                    <span>Card Holder</span>
                                    <div>${item.cardHolder || 'NAME'}</div>
                                </div>
                                <div class="card-expiry">
                                    <span>Expires</span>
                                    <div>${item.cardExpiry || 'MM/YY'}</div>
                                </div>
                            </div>
                        </div>
                        <div class="card-face card-back">
                            <div class="card-strip"></div>
                            <div class="card-signature-block">
                                <div class="card-cvv-box">${item.cardCvv || '***'}</div>
                            </div>
                            <div class="card-full-number">
                                ${n}
                                <button class="copy-number-btn" title="Copy Number">📋</button>
                            </div>
                        </div>
                    </div>
                `;

                // Append Edit Buttons safely to contexts
                card.querySelector('.card-front').appendChild(editBtnFront);
                card.querySelector('.card-back').appendChild(editBtnBack);

                // Copy Logic
                card.querySelector('.copy-number-btn').onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(n);
                    showToast('Card Number Copied!');
                };

                // Flip Logic
                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });

            } else {
                // PASSWORD CARD (3D FLIP)
                // Reusing structure
                card.className = 'vault-item-card credit-card-container';

                // Edit Button Helper (Same as Card)
                const createEditBtn = () => {
                    const btn = document.createElement('button');
                    btn.className = 'card-edit-btn';
                    btn.innerHTML = '✏️';
                    btn.title = 'Edit Details';
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        onEdit(item);
                    };
                    return btn;
                };

                const editBtnFront = createEditBtn();
                const editBtnBack = createEditBtn();

                card.innerHTML = `
                    <div class="card-inner">
                        <div class="card-face card-front password-card-bg">
                             <div class="password-face-content">
                                <div class="password-front-icon">🔑</div>
                                <div class="password-front-name">${item.name}</div>
                                <div class="password-front-username">${item.username || ''}</div>
                             </div>
                        </div>
                        <div class="card-face card-back password-card-bg">
                            <div class="password-back-content">
                                
                                <div class="password-row">
                                    <div style="flex:1; overflow:hidden;">
                                        <div class="password-row-label">Username</div>
                                        <div class="password-row-value">${item.username || '---'}</div>
                                    </div>
                                    <button class="password-action-btn btn-copy-user" title="Copy Username">👤</button>
                                </div>

                                <div class="password-row">
                                    <div style="flex:1; overflow:hidden;">
                                        <div class="password-row-label">Password</div>
                                        <div class="password-row-value password-text">${item.password ? '••••••••' : '---'}</div>
                                    </div>
                                    <div style="display:flex; gap:2px;">
                                        <button class="password-action-btn btn-view-pass" title="Show/Hide">👁️</button>
                                        <button class="password-action-btn btn-copy-pass" title="Copy">📋</button>
                                    </div>
                                </div>

                                <button class="password-url-btn btn-launch" ${!item.url ? 'disabled' : ''}>
                                    🔗 Open URL
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Append Edit Buttons
                card.querySelector('.card-front').appendChild(editBtnFront);
                card.querySelector('.card-back').appendChild(editBtnBack);

                // Event Listeners for Back Actions
                const btnCopyUser = card.querySelector('.btn-copy-user');
                btnCopyUser.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.username || '');
                    showToast('Username copied!');
                };

                const btnViewPass = card.querySelector('.btn-view-pass');
                const btnCopyPass = card.querySelector('.btn-copy-pass');
                const passText = card.querySelector('.password-text');
                let isPassVisible = false;

                if (btnViewPass) {
                    btnViewPass.onclick = (e) => {
                        e.stopPropagation();
                        isPassVisible = !isPassVisible;
                        if (isPassVisible) {
                            passText.textContent = item.password || '';
                            btnViewPass.innerHTML = '🙈';
                        } else {
                            passText.textContent = '••••••••';
                            btnViewPass.innerHTML = '👁️';
                        }
                    };
                }

                btnCopyPass.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.password || '');
                    showToast('Password copied!');
                };

                const btnLaunch = card.querySelector('.btn-launch');
                btnLaunch.onclick = (e) => {
                    e.stopPropagation();
                    if (item.url) {
                        let url = item.url;
                        if (!url.startsWith('http')) url = 'https://' + url;
                        window.open(url, '_blank');
                    }
                };

                // Flip Logic
                card.addEventListener('click', () => {
                    card.classList.toggle('flipped');
                });
            }
            this.itemsGrid.appendChild(card);
        });
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

// Global helper for the render function closures if needed, 
// though we put it in UI object, simpler to just define it on window or outside
function showToast(msg) {
    UI.showToast(msg);
}
