import { authorize } from "../services/auth/authorization.js";

/** Every scope request is evaluated against current account and resource policy. */
export function requireScope(required, options = {}) {
    return async (req, res, next) => {
        try {
            const value = typeof required === "function" ? await required(req, res) : required;
            const scopes = Array.isArray(value) ? value : [value];
            if (!scopes.length || scopes.some((scope) => typeof scope !== "string" || !scope.trim())) {
                return res.status(400).json({ status: "error", message: "无效的权限要求", code: "ZC_ERROR_INVALID_SCOPE" });
            }
            const context = (typeof options === "function" ? await options(req, res) : options) || {};
            const decisions = [];
            for (const scope of scopes) {
                const decision = await authorize({
                    ...context, userId: res.locals.userid, requiredScope: scope.trim(),
                    tokenType: res.locals.tokenType, tokenScopes: res.locals.scopes || [],
                    delegationId: context.delegationId ?? req.headers?.["x-zerocat-delegation"],
                });
                if (!decision.allowed) {
                    return res.status(decision.status).json({
                        status: "error", message: decision.message, code: decision.code, required: decision.required,
                    });
                }
                decisions.push(decision);
            }
            res.locals.authorization = decisions.length === 1 ? decisions[0] : decisions;
            next();
        } catch (error) {
            next(error);
        }
    };
}

function hasValue(value) {
    return value !== undefined && value !== null && String(value).length > 0;
}

function readValue(source, key) {
    if (!source || !key) return undefined;
    if (hasValue(source[key])) return source[key];
    return String(key).split(".").reduce((value, part) => value?.[part], source);
}

function resolveResourceId(req, selector) {
    if (!selector) return undefined;
    if (typeof selector === "function") return selector(req);
    if (Array.isArray(selector)) {
        for (const item of selector) {
            const value = resolveResourceId(req, item);
            if (hasValue(value)) return value;
        }
        return undefined;
    }
    if (typeof selector !== "string") return undefined;
    return readValue(req.params, selector) ?? readValue(req.body, selector)
        ?? readValue(req.query, selector) ?? readValue(req.headers, selector.toLowerCase());
}

/** Missing selected resource IDs fail closed instead of falling back to a type-wide grant. */
export function requireResource(resource, action, idParam, options = {}) {
    return requireScope((req) => {
        if (!idParam) return `${resource}:${action}`;
        const id = resolveResourceId(req, idParam);
        if (Array.isArray(id)) return id.map((item) => hasValue(item) ? `${resource}:${item}:${action}` : "");
        return hasValue(id) ? `${resource}:${id}:${action}` : "";
    }, options);
}

export default { requireScope, requireResource };
