# [Vault](https://akgarhwal.github.io/vault/) (Secure Password Manager)

A simple, secure, and modern Password Manager built with **Vanilla JavaScript, HTML, and CSS**. No frameworks, no trackers, just pure web technologies.

[![Vault](https://img.shields.io/badge/Access%20Vault-purple?style=for-the-badge&logo=lock)](https://akgarhwal.github.io/vault/)

## 🔒 Features

-   **Client-Side Encryption**: Uses **Web Crypto API** (AES-256-GCM & PBKDF2-SHA-256 at 600,000 iterations) to encrypt your data before it is saved. Your master password never leaves your browser.
-   **Local Storage**: Data is persisted in your browser's `localStorage`.
-   **Modern UI**: Glassmorphism design, Dark Mode, and 3D Flip interactions for Credit Cards.
-   **Rich Credit Cards**: Visual representation of cards (Visa/Mastercard styling), copy to clipboard, and flip to reveal CVV.
-   **Import/Export**: Backup your encrypted vault to JSON and restore it on any device.
-   **Auto-Lock**: Locks after 120 seconds of inactivity, or 30 seconds after the tab is hidden. Lock reloads the page so plaintext is dropped from memory.

## 🚀 How to Run Locally

Because this project uses **ES Modules** and **Web Crypto API**, it must be served over `http://` or `https://`. File protocol (`file://`) will **not** work.

### Using Python (Mac/Linux/Windows)
If you have Python installed:

```bash
# 1. Navigate to the project folder
cd vault

# 2. Start a simple server
python3 -m http.server 8080

# 3. Open in browser
http://localhost:8080
```

### Using VS Code
1.  Install the **Live Server** extension.
2.  Right-click `index.html` and select **Open with Live Server**.


## ⚠️ Security Notice

-   **Zero Knowledge**: We cannot recover your Master Password. If you lose it, your data is lost forever.
-   **Browser Storage**: Clearing your browser cache/storage **will delete your vault**. Please use the **Export** feature regularly to backup your data.
-   **Old vaults**: Vaults created with the previous 100,000-iteration KDF are re-encrypted automatically on the next successful unlock.
-   **What this protects**: Encrypted data at rest (localStorage, export files, sync files) against someone who does not know a strong master password.
-   **What this cannot protect**: Malware, a malicious browser extension, a compromised copy of this site's JavaScript, or an unlocked session on a shared device.

Master password rules: at least 12 characters, and either 3 character classes or a 16+ character passphrase.
