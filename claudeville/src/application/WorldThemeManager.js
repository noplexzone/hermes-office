import { DEFAULT_WORLD_THEME_ID, getWorldTheme, isThemeCssVariableAllowed, isWorldThemeId, resolveStoredWorldTheme, setActiveWorldTheme } from '../config/worldThemes.js';

export const WORLD_THEME_STORAGE_KEY = 'hermes-office.world-theme';

export class WorldThemeManager {
    constructor({ storage, document: documentRef, reload } = {}) {
        if (storage !== undefined) this.storage = storage;
        else {
            try { this.storage = globalThis.localStorage; }
            catch { this.storage = null; }
        }
        this.document = documentRef === undefined ? globalThis.document : documentRef;
        this.reload = reload || (() => globalThis.location?.reload?.());
        this.current = getWorldTheme(DEFAULT_WORLD_THEME_ID);
    }

    apply() {
        this.current = setActiveWorldTheme(resolveStoredWorldTheme(this.storage, WORLD_THEME_STORAGE_KEY));
        const style = this.document?.documentElement?.style;
        for (const [name, value] of Object.entries(this.current.chrome || {})) {
            if (isThemeCssVariableAllowed(name)) style?.setProperty?.(name, value);
        }
        this.document?.body?.setAttribute?.('data-world-theme', this.current.id);
        return this.current;
    }

    select(id) {
        if (!isWorldThemeId(id) || id === this.current.id) return false;
        if (typeof this.storage?.setItem !== 'function') return false;
        try {
            this.storage.setItem(WORLD_THEME_STORAGE_KEY, id);
        } catch {
            return false;
        }
        this.reload();
        return true;
    }
}
