import { Router } from "express";
import { needLogin } from "../middleware/auth.js";
import logger from "../services/logger.js";
import delegationService from "../services/auth/delegationService.js";

function context(req, res) {
    return { tokenType: res.locals.tokenType, tokenScopes: res.locals.scopes || [],
        delegationId: req.headers?.["x-zerocat-delegation"] };
}

export function createDelegationsRouter({ service = delegationService, login = needLogin } = {}) {
    const router = Router();
    router.use(login);
    const handler = (operation) => async (req, res) => {
        try {
            res.json({ status: "success", data: await operation(req, res) });
        } catch (error) {
            if (error.status) return res.status(error.status).json({ status: "error", code: error.code, message: error.message });
            logger.error(`[delegations] 操作失败: ${error?.message || error}`);
            res.status(500).json({ status: "error", code: "ZC_ERROR_INTERNAL_SERVER_ERROR", message: "委托操作失败" });
        }
    };
    router.get("/", handler((req, res) => service.listDelegations(res.locals.userid, context(req, res))));
    router.post("/", handler((req, res) => service.createDelegation(res.locals.userid, req.body || {}, context(req, res))));
    for (const action of ["accept", "decline", "revoke"]) {
        router.post(`/:id/${action}`, handler((req, res) => service.respondToDelegation(res.locals.userid,
            req.params.id, action, context(req, res))));
    }
    return router;
}

export default createDelegationsRouter();
