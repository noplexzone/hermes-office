const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
};

export const DEFAULT_WORLD_THEME_ID = 'keep-at-night';

const KEEP_AT_NIGHT = {
    id: DEFAULT_WORLD_THEME_ID,
    name: 'Keep at Night',
    description: 'The original torchlit island village.',
    chrome: {
        '--world-chrome-bg': '#1b120d',
        '--world-chrome-panel': 'rgba(31, 22, 18, 0.96)',
        '--world-chrome-accent': '#f2d36b',
        '--world-chrome-text': '#f6da82',
    },
    world: {
        waterTokens: null,
        multiplyGrade: null,
    },
    buildings: {},
    atmosphere: { place: 'Village' },
    assets: { manifestPath: 'assets/sprites/manifest.yaml', fallbackThemeId: null },
    profileOverrides: {},
};

const INFINITE_INDEX = {
    id: 'infinite-index',
    name: 'The Infinite Index',
    description: 'An endless archive of branching paths and living ledgers.',
    chrome: {
        '--world-chrome-bg': '#080d08',
        '--world-chrome-panel': 'rgba(15, 21, 13, 0.97)',
        '--world-chrome-accent': '#a99a56',
        '--world-chrome-text': '#ddd0a5',
        '--world-topbar-radial': 'radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--world-chrome-accent) 14%, transparent), transparent 30%)',
        '--world-topbar-depth': 'linear-gradient(180deg, color-mix(in srgb, var(--world-chrome-panel) 92%, var(--world-chrome-accent)), var(--world-chrome-bg))',
        '--world-topbar-stripe': 'linear-gradient(90deg, transparent, transparent)',
        '--world-topbar-border': 'var(--world-chrome-accent)',
        '--cv-bg': '#070b07',
        '--cv-panel': 'rgba(15, 21, 13, 0.97)',
        '--cv-panel-deep': 'rgba(8, 13, 8, 0.99)',
        '--cv-panel-warm': 'rgba(42, 45, 24, 0.74)',
        '--cv-gold': '#c5b873',
        '--cv-gold-deep': '#8d8147',
        '--cv-gold-bright': '#e5d7a4',
        '--cv-gold-warm': '#d8c98f',
        '--cv-gold-soft': '#b7aa73',
        '--cv-text-muted': '#9e9a79',
    },
    world: {
        waterTokens: {
            lagoon: { shallow: '#536b36', deep: '#28391e', glint: '184, 178, 112', rainRipple: '209, 202, 151', fogWash: '163, 174, 126', wake: '211, 204, 153' },
            river: { shallow: '#40552c', deep: '#1b2b18', glint: '166, 164, 99', rainRipple: '202, 198, 145', fogWash: '148, 158, 111', wake: '197, 193, 137' },
            sea: { shallow: '#314421', deep: '#0c160d', glint: '147, 148, 82', rainRipple: '185, 184, 128', fogWash: '126, 140, 99', wake: '195, 190, 132' },
            harbor: { shallow: '#384c25', deep: '#142016', glint: '172, 165, 96', rainRipple: '196, 190, 135', fogWash: '140, 151, 105', wake: '205, 198, 142' },
            water: { shallow: '#3c5128', deep: '#172419', glint: '177, 171, 105', rainRipple: '205, 199, 146', fogWash: '148, 159, 113', wake: '208, 201, 147' },
        },
        multiplyGrade: {
            day: { base: 'rgb(225, 226, 190)', edge: 'rgb(145, 153, 106)', edgeAlpha: 0.34 },
            night: { base: 'rgb(84, 105, 70)', edge: 'rgb(36, 53, 31)', edgeAlpha: 0.52 },
            dusk: { base: 'rgb(177, 171, 119)', edge: 'rgb(91, 100, 62)', edgeAlpha: 0.46 },
            dawn: { base: 'rgb(195, 190, 143)', edge: 'rgb(106, 113, 74)', edgeAlpha: 0.42 },
        },
        terrain: {
            revision: 'archive-visuals-v1',
            ground: { grassDark: '#101b12', grassMid: '#24331e', grassLight: '#3d4928', forest: '#08110a' },
            shore: { base: '#c5b98f', accent: '#e0d4aa' },
            path: { base: '#93855b', dark: '#554e34', line: '#d7ca9d' },
            plaza: { base: '#81764f', dark: '#403b29' },
            water: { deepBlend: '#07110c', shoreBed: '#b9ab7b' },
            backdrop: { far: '#07100a', middle: '#182218', near: '#020604' },
            rim: { face: '#172016', edge: '#8f8147', shelf: '#cabe91' },
        },
        atmosphere: {
            perspective: { far: '#9ca376', middle: '#d4cfaa', near: '#ffffff', alpha: 0.58 },
            distantWater: {
                day: { shallow: '#3d5130', deep: '#0b1710' },
                night: { shallow: '#1d2b20', deep: '#050b07' },
                dusk: { shallow: '#4b4d2c', deep: '#151b11' },
                dawn: { shallow: '#59613d', deep: '#1c2818' },
            },
            motifs: [
                { kind: 'ledger-lines', color: '#b8aa70', spacing: 6, alpha: 0.20 },
                { kind: 'folio-marks', color: '#ddd0a5', spacing: 7, alpha: 0.30 },
            ],
        },
        landmarks: {
            revision: 'archive-landmarks-v1',
            tint: { color: '#172318', alpha: 0.34, highlight: '#d8cca1', highlightAlpha: 0.10 },
            frame: { outer: '#756a37', inner: '#d5c793', shadow: '#070c08', plate: '#202719' },
            ornaments: {
                command: { kind: 'index-crown', position: 'crown' },
                taskboard: { kind: 'ledger-tabs', position: 'lintel' },
                archive: { kind: 'stack-spines', position: 'crown' },
                mine: { kind: 'well-rings', position: 'lintel' },
                forge: { kind: 'quill-nib', position: 'crown' },
                harbor: { kind: 'ink-drop', position: 'lintel' },
                watchtower: { kind: 'vigil-eye', position: 'crown' },
                observatory: { kind: 'orrery', position: 'crown' },
                portal: { kind: 'codex-seal', position: 'lintel' },
            },
        },
    },
    buildings: {
        command: { label: 'THE GREAT INDEX', shortLabel: 'INDEX' },
        taskboard: { label: 'THE LIVING LEDGER', shortLabel: 'LEDGER' },
        archive: { label: 'THE DEEP STACKS', shortLabel: 'STACKS' },
        mine: { label: 'THE MEMORY WELL', shortLabel: 'WELL' },
        forge: { label: 'THE SCRIPTORIUM', shortLabel: 'SCRIPTORIUM' },
        harbor: { label: 'THE INKWELL DOCKS', shortLabel: 'INK DOCKS' },
        watchtower: { label: 'THE VIGILANT LENS', shortLabel: 'LENS' },
        observatory: { label: 'ORRERY OF PATHS', shortLabel: 'ORRERY' },
        portal: { label: 'THE SEALED CODEX', shortLabel: 'CODEX' },
    },
    atmosphere: { place: 'Index' },
    assets: { manifestPath: 'assets/sprites/manifest.yaml', fallbackThemeId: DEFAULT_WORLD_THEME_ID },
    profileOverrides: {
        jarvis: { spriteId: 'agent.codex.gpt56sol', equipment: 'dawnblade', effortWeapon: 'dawnblade', trim: ['#d8c98f', '#f0dfaa', '#89a867'], accent: ['#f5e8bd', '#c7b568', '#9bb67a'], minimapColor: '#d8c98f' },
        light: { spriteId: 'agent.codex.gpt56luna', equipment: 'crescentSaber', effortWeapon: 'crescentSaber', trim: ['#d9e4e0', '#a6bfd0', '#8fae78'], accent: ['#f1f6ef', '#c8dbe4', '#a3bd8b'], minimapColor: '#c8dbe4' },
        l: { spriteId: 'agent.codex.gpt56terra', equipment: 'earthbreaker', effortWeapon: 'earthbreaker', trim: ['#b88b57', '#879b56', '#7f9964'], accent: ['#d7b27d', '#a8b875', '#94ad75'], minimapColor: '#b88b57' },
    },
};

export const WORLD_THEMES = deepFreeze({
    [KEEP_AT_NIGHT.id]: KEEP_AT_NIGHT,
    [INFINITE_INDEX.id]: INFINITE_INDEX,
});

const hasWorldTheme = (id) => Object.prototype.hasOwnProperty.call(WORLD_THEMES, id);

let activeWorldTheme = WORLD_THEMES[DEFAULT_WORLD_THEME_ID];

const PROFILE_PRESENTATION_KEYS = new Set([
    'spriteId', 'paletteKey', 'trim', 'accent', 'minimapColor', 'equipment',
    'effortWeapon', 'suppressBakedWeapon', 'effortAccessory', 'effortFloorRing',
]);

export function isWorldThemeId(id) {
    return hasWorldTheme(id);
}

export function getWorldTheme(id) {
    return hasWorldTheme(id) ? WORLD_THEMES[id] : WORLD_THEMES[DEFAULT_WORLD_THEME_ID];
}

export function listWorldThemes() {
    return Object.values(WORLD_THEMES);
}

export function setActiveWorldTheme(theme) {
    activeWorldTheme = getWorldTheme(theme?.id);
    return activeWorldTheme;
}

export function getActiveWorldTheme() {
    return activeWorldTheme;
}

export function resolveStoredWorldTheme(storage, key = 'hermes-office.world-theme') {
    try {
        const stored = storage?.getItem?.(key);
        return hasWorldTheme(stored) ? WORLD_THEMES[stored] : getWorldTheme(DEFAULT_WORLD_THEME_ID);
    } catch {
        return getWorldTheme(DEFAULT_WORLD_THEME_ID);
    }
}

export function getThemedBuildingDefs(baseDefs, theme) {
    const presentation = getWorldTheme(theme?.id).buildings;
    return baseDefs.map((definition) => ({ ...definition, ...(presentation[definition.type] || {}) }));
}

export function isThemeCssVariableAllowed(name) {
    return String(name || '').startsWith('--') && !String(name).startsWith('--cv-status-');
}

const TERRAIN_VISUAL_FIELDS = Object.freeze([
    ['ground', ['grassDark', 'grassMid', 'grassLight', 'forest']],
    ['shore', ['base', 'accent']],
    ['path', ['base', 'dark', 'line']],
    ['plaza', ['base', 'dark']],
    ['water', ['deepBlend', 'shoreBed']],
    ['backdrop', ['far', 'middle', 'near']],
    ['rim', ['face', 'edge', 'shelf']],
]);

function isCompleteTerrainVisualPackage(terrain) {
    if (!terrain || typeof terrain !== 'object' || typeof terrain.revision !== 'string') return false;
    return TERRAIN_VISUAL_FIELDS.every(([section, fields]) => {
        const values = terrain[section];
        return values && typeof values === 'object'
            && fields.every((field) => typeof values[field] === 'string' && values[field].trim());
    });
}

export function getWorldVisualPackage(theme = activeWorldTheme) {
    const world = theme?.world || {};
    return {
        terrain: isCompleteTerrainVisualPackage(world.terrain) ? world.terrain : null,
        atmosphere: world.atmosphere || null,
        landmarks: world.landmarks || null,
    };
}

export function mergeWorldThemeTable(baseTable, overrideTable) {
    if (!overrideTable) return baseTable;
    return Object.fromEntries(Object.entries(baseTable).map(([key, baseValue]) => {
        const overrideValue = overrideTable[key];
        if (!baseValue || typeof baseValue !== 'object' || Array.isArray(baseValue)) {
            return [key, overrideValue ?? baseValue];
        }
        return [key, { ...baseValue, ...(overrideValue && typeof overrideValue === 'object' ? overrideValue : {}) }];
    }));
}

export function getWorldThemeAssetManifestPaths(theme) {
    const paths = [];
    const seenThemes = new Set();
    let current = hasWorldTheme(theme?.id) ? WORLD_THEMES[theme.id] : theme;
    while (current && !seenThemes.has(current.id)) {
        seenThemes.add(current.id);
        const path = String(current.assets?.manifestPath || '').trim();
        if (path && !paths.includes(path)) paths.push(path);
        const fallbackId = current.assets?.fallbackThemeId;
        current = hasWorldTheme(fallbackId) ? WORLD_THEMES[fallbackId] : null;
    }
    if (!paths.length) paths.push(WORLD_THEMES[DEFAULT_WORLD_THEME_ID].assets.manifestPath);
    return paths;
}

export function applyWorldThemeProfileOverride(identity, profile, theme = activeWorldTheme) {
    const requested = theme?.profileOverrides?.[String(profile || '').trim().toLowerCase()];
    if (!requested || typeof requested !== 'object') return identity;
    const safeOverride = {};
    for (const [key, value] of Object.entries(requested)) {
        if (PROFILE_PRESENTATION_KEYS.has(key)) safeOverride[key] = value;
    }
    return { ...identity, ...safeOverride };
}
