(function () {
    const banner = document.getElementById('warning-banner');
    if (!banner) return;

    if (window.location.protocol === 'file:') {
        banner.classList.add('is-visible');
    }

    if (!window.crypto || !window.crypto.subtle) {
        banner.classList.add('is-visible');
        const extra = document.createElement('p');
        extra.textContent = 'Security Error: Web Crypto API is not available (requires HTTPS or localhost).';
        banner.appendChild(extra);
    }
})();
