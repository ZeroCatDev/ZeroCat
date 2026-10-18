import { authorize } from "./authorization.js";

export function resourceAuthorizationContext(req, res) {
    return {
        tokenType: res.locals.tokenType,
        tokenScopes: res.locals.scopes || [],
        delegationId: req.headers?.["x-zerocat-delegation"],
    };
}

/** Re-evaluate the original credentials at the operation, never a middleware decision. */
export async function authorizeResourceOperation(actorId, resource, resourceId, action, context) {
    if (!context) return { actorId: Number(actorId), principalId: Number(actorId), delegationId: null };
    const decision = await authorize({
        tokenType: context.tokenType,
        tokenScopes: context.tokenScopes || [],
        delegationId: context.delegationId,
        actorId: Number(actorId),
        requiredScope: `${resource}:${resourceId}:${action}`,
        allowDelegation: true,
    });
    if (!decision.allowed) {
        throw Object.assign(new Error(decision.message), {
            status: decision.status, statusCode: decision.status, code: decision.code,
        });
    }
    return decision;
}
