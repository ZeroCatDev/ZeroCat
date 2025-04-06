import { Router } from "express";
import { needlogin, strictTokenCheck } from "../middleware/auth.js";
import starsRouter from "./router_stars.js";
import listsRouter from "./router_lists.js";

const router = Router();

// Mount the star and list routers
router.use("/stars", starsRouter);
router.use("/lists", listsRouter);

export default router;
