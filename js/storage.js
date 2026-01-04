const KEYS = {
    VAULT_META: 'vault_meta',
    VAULT_ITEMS: 'vault_items'
};

export const Storage = {
    getMeta() {
        const data = localStorage.getItem(KEYS.VAULT_META);
        return data ? JSON.parse(data) : null;
    },

    setMeta(meta) {
        localStorage.setItem(KEYS.VAULT_META, JSON.stringify(meta));
    },

    getItems() {
        const data = localStorage.getItem(KEYS.VAULT_ITEMS);
        return data ? JSON.parse(data) : [];
    },

    saveItems(items) {
        localStorage.setItem(KEYS.VAULT_ITEMS, JSON.stringify(items));
    },

    clear() {
        localStorage.removeItem(KEYS.VAULT_META);
        localStorage.removeItem(KEYS.VAULT_ITEMS);
    }
};
