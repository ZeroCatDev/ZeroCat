export const RESTRICTION_CATEGORIES = [
    "profile", "posts", "projects", "blog", "comments", "lists",
    "relations", "activity", "assets", "extensions",
];

const CATEGORY_ALIASES = {
    user: "profile", post: "posts", project: "projects", comment: "comments",
    comment_service: "comments", list: "lists", follow: "relations", relation: "relations",
    event: "activity", asset: "assets", extension: "extensions",
};

export class ModerationError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.statusCode = status;
        this.code = code;
    }
}

export function categoryFor(value) {
    return CATEGORY_ALIASES[value] || value;
}

export function normalizeCategories(values = ["*"]) {
    if (!Array.isArray(values) || !values.length || values.some((v) => v !== "*" && !RESTRICTION_CATEGORIES.includes(v))) {
        throw new ModerationError(400, "INVALID_RESTRICTION_CATEGORIES", "请选择有效的限制范围");
    }
    return values.includes("*") ? ["*"] : [...new Set(values)];
}

export function restrictionIsActive(rule, now = new Date()) {
    const time = Number(now);
    return !rule.revoked_at && Number(new Date(rule.starts_at)) <= time
        && (!rule.expires_at || Number(new Date(rule.expires_at)) > time);
}

export function restrictionCovers(rule, category) {
    const categories = Array.isArray(rule.categories) ? rule.categories : [];
    return categories.includes("*") || categories.includes(categoryFor(category));
}

export function contentIsShadowbanned(record, now = new Date()) {
    return record?.is_shadowbanned === true
        && (!record.shadowban_expires_at || Number(new Date(record.shadowban_expires_at)) > Number(now));
}

export function isPublicMutation(action) {
    return ["create", "update", "delete", "restore", "interact", "manage", "write", "publish", "sync"].includes(action);
}

export function positiveId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new ModerationError(400, "INVALID_RESOURCE_ID", "无效资源 ID");
    return id;
}

export function optionalDate(value, field = "expires_at") {
    if (value === null || value === undefined || value === "") return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new ModerationError(400, "INVALID_DATE", `${field} 日期无效`);
    return date;
}
