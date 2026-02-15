import logger from "../services/logger.js";
import {Router} from "express";
import {needLogin} from "../middleware/auth.js";
import {createEvent} from "../controllers/events.js";
import {getProjectStars, getProjectStarStatus, starProject, unstarProject,} from "../controllers/stars.js";

const router = Router();

/**
 * Star a project
 * @route POST /star
 * @access Private
 */
router.post("/star", needLogin, async (req, res) => {
    try {
        const projectId = parseInt(req.body.projectid);

        if (!projectId) {
            return res
                .status(400)
                .send({status: "error", message: "项目ID不能为空"});
        }

        await starProject(res.locals.userid, projectId);

        // Add star event
        await createEvent(
            "project_star",
            res.locals.userid,
            "project",
            projectId,
            {
                event_type: "project_star",
                actor_id: res.locals.userid,
                target_type: "project",
                target_id: projectId,
                action: "star",
                notification_title: "项目收藏",
                notification_content: "有人收藏了你的项目",
            }
        );

        res.status(200).send({status: "success", message: "收藏成功", star: 1});
    } catch (err) {
        logger.error("Error starring project:", err);
        res.status(500).send({status: "error", message: "收藏项目时出错"});
    }
});

/**
 * Unstar a project
 * @route POST /unstar
 * @access Private
 */
router.post("/unstar", needLogin, async (req, res) => {
    try {
        const projectId = parseInt(req.body.projectid);

        if (!projectId) {
            return res
                .status(400)
                .send({status: "error", message: "项目ID不能为空"});
        }

        await unstarProject(res.locals.userid, projectId);

        res
            .status(200)
            .send({status: "success", message: "取消收藏成功", star: 0});
    } catch (err) {
        logger.error("Error unstarring project:", err);
        res.status(500).send({status: "error", message: "取消收藏项目时出错"});
    }
});

/**
 * Check if a project is starred by the current user
 * @route GET /checkstar
 * @access Public
 */
router.get("/checkstar", async (req, res) => {
    try {
        const projectId = parseInt(req.query.projectid);

        if (!projectId) {
            return res
                .status(400)
                .send({status: "error", message: "项目ID不能为空"});
        }

        const status = await getProjectStarStatus(res.locals.userid, projectId);
        res.status(200).send({
            status: "success",
            message: "获取成功",
            star: status,
        });
    } catch (err) {
        logger.error("Error checking star status:", err);
        res.status(500).send({status: "error", message: "检查收藏状态时出错"});
    }
});

/**
 * Get the number of stars for a project
 * @route GET /project/:id/stars
 * @access Public
 */
router.get("/project/:id/stars", async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);

        if (!projectId) {
            return res.status(400).send({status: "error", message: "项目ID不能为空"});
        }

        const stars = await getProjectStars(projectId);
        res.status(200).send({
            status: "success",
            message: "获取成功",
            data: stars,
        });
    } catch (err) {
        logger.error("Error getting project stars:", err);
        res.status(500).send({status: "error", message: "获取项目收藏数时出错"});
    }
});

export default router;
