const normalizeMd5Ext = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const withoutQuery = raw.split('?')[0].split('#')[0];
    const filename = withoutQuery.split('/').pop() || '';
    if (!filename || !filename.includes('.')) return null;

    const dotIndex = filename.indexOf('.');
    const md5 = filename.slice(0, dotIndex).toLowerCase();
    const ext = filename.slice(dotIndex + 1).toLowerCase();

    if (!/^[a-f0-9]{32}$/.test(md5)) return null;
    if (!/^[a-z0-9]+$/.test(ext)) return null;

    return `${md5}.${ext}`;
};

export const extractScratchAssetMd5ExtList = (projectJson) => {
    const targets = Array.isArray(projectJson?.targets) ? projectJson.targets : [];
    const values = new Set();

    for (const target of targets) {
        const costumes = Array.isArray(target?.costumes) ? target.costumes : [];
        for (const costume of costumes) {
            const md5ext = normalizeMd5Ext(costume?.md5ext || `${costume?.assetId || ''}.${costume?.dataFormat || ''}`);
            if (md5ext) values.add(md5ext);
        }

        const sounds = Array.isArray(target?.sounds) ? target.sounds : [];
        for (const sound of sounds) {
            const md5ext = normalizeMd5Ext(sound?.md5ext || `${sound?.assetId || ''}.${sound?.dataFormat || ''}`);
            if (md5ext) values.add(md5ext);
        }
    }

    return Array.from(values);
};

export const buildScratchAssetS3Key = (md5ext) => {
    const normalized = normalizeMd5Ext(md5ext);
    if (!normalized) return null;
    const [md5] = normalized.split('.');
    return `assets/${md5.slice(0, 2)}/${md5.slice(2, 4)}/${normalized}`;
};
