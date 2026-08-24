import { getWorldThemeAssetManifestPaths } from '../config/worldThemes.js';

export async function loadWorldThemeAssets(theme, {
    AssetManagerClass,
    signal = null,
    onFallback = null,
} = {}) {
    if (typeof AssetManagerClass !== 'function') {
        throw new TypeError('AssetManagerClass is required');
    }
    const manifestPaths = getWorldThemeAssetManifestPaths(theme);
    let firstError = null;
    for (let index = 0; index < manifestPaths.length; index++) {
        const manifestPath = manifestPaths[index];
        const assets = new AssetManagerClass({ manifestPath });
        try {
            const loaded = await assets.load({ signal });
            if (!loaded) {
                throw new Error(`[WorldThemeAssetLoader] load did not complete for ${manifestPath}`);
            }
            if (index > 0) onFallback?.({ manifestPath, failedManifestPath: manifestPaths[0], error: firstError });
            return assets;
        } catch (error) {
            assets.dispose?.();
            if (signal?.aborted || error?.name === 'AbortError') return null;
            firstError ||= error;
            if (index === manifestPaths.length - 1) throw firstError;
        }
    }
    throw new Error('[WorldThemeAssetLoader] no manifest candidates');
}
