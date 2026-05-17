import zcconfig from "../services/config/zcconfig.js";

let _staticUrl = null;

async function getStaticUrl() {
    if (_staticUrl === null) {
        const raw = await zcconfig.get("s3.staticurl");
        _staticUrl = (raw || "").replace(/\/+$/, "");
    }
    return _staticUrl;
}

/**
 * Convert an avatar key/hash to a full URL (synchronous).
 * @param {string|null} avatar - Avatar hash/key from database
 * @param {string} staticUrl - Base static URL (without trailing slash)
 * @returns {string|null}
 */
export function toAvatarURL(avatar, staticUrl) {
    if (!avatar) return null;
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
        return avatar;
    }
    if (!staticUrl) return null;
    return `${staticUrl}/assets/${avatar.substring(0, 2)}/${avatar.substring(2, 4)}/${avatar}.webp`;
}

/**
 * Asynchronously build a full avatar URL from an avatar key/hash.
 * Caches the static base URL after the first call.
 * @param {string|null} avatar - Avatar hash/key from database
 * @returns {Promise<string|null>}
 */
export async function buildAvatarURL(avatar) {
    if (!avatar) return null;
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
        return avatar;
    }
    const staticUrl = await getStaticUrl();
    return toAvatarURL(avatar, staticUrl);
}
