import logger from './services/logger.js';
import paths from './paths.js';
import zcconfig from './services/config/zcconfig.js';


/**
 * 配置应用路由
 * @param {express.Application} app Express应用实例
 */
export async function configureRoutes(app) {
    // 加载配置信息到全局
    await zcconfig.loadConfigsFromDB();
    logger.info('[routes] 配置信息已加载到全局');

    // 设置视图目录和引擎
    app.set("env", process.cwd());
    app.set("data", paths.DATA_DIR);
    //logger.debug(paths.VIEWS_DIR)
    app.set("views", paths.VIEWS_DIR);
    app.set("view engine", "ejs");

    logger.debug('[routes] 视图目录:', paths.VIEWS_DIR);
    // 首页路由
    app.get("/", (req, res) => {
        res.render("index");
    });

    // 健康检查路由
    app.get("/check", (req, res) => {
        res.status(200).json({
            message: "success",
            code: 200,
        });
    });

    // Scratch工具路由
    app.get("/scratchtool", (req, res) => {
        res.set("Content-Type", "application/javascript");
        res.render("scratchtool");
    });

    // 注册业务路由
    await registerBusinessRoutes(app);
    // 404路由处理
    app.all("/{*path}", (req, res) => {
        res.status(404).json({
            status: "error",
            code: "404",
            message: "找不到页面",
        });
    });
}

/**
 * 注册业务相关路由
 * @param {express.Application} app Express应用实例
 */
async function registerBusinessRoutes(app) {
    try {
        // 新的标准化路由注册
        const accountModule = await import('./routes/router_account.js');
        app.use("/account", accountModule.default);

        const eventModule = await import('./routes/router_event.js');
        app.use("/events", eventModule.default);

        // 统计分析路由
        const analyticsModule = await import('./routes/router_analytics.js');
        app.use("/analytics", analyticsModule.default);

        // 使用新的通知路由 (获取绝对路径版本)
        const notificationModule = await import('./routes/router_notifications.js');
        app.use("/notifications", notificationModule.default);

        // 个人中心路由
        const myModule = await import('./routes/router_my.js');
        app.use("/my", myModule.default);

        // 搜索API路由
        const searchModule = await import('./routes/router_search.js');
        app.use("/searchapi", searchModule.default);

        // Scratch路由
        const scratchModule = await import('./routes/router_scratch.js');
        app.use("/scratch", scratchModule.default);

        // API路由
        const apiModule = await import('./routes/router_api.js');
        app.use("/api", apiModule.default);

        // 管理后台路由
        const adminModule = await import('./routes/router_admin.js');
        app.use("/admin", adminModule.default);

        // 项目列表路由
        const projectlistModule = await import('./routes/router_projectlist.js');
        app.use("/projectlist", projectlistModule.default);

        // 项目路由
        const projectModule = await import('./routes/router_project.js');
        app.use("/project", projectModule.default);

        // 评论路由
        const commentModule = await import('./routes/router_comment.js');
        app.use("/comment", commentModule.default);

        // 用户路由
        const userModule = await import('./routes/router_user.js');
        app.use("/user", userModule.default);

        // 时间线路由
        const timelineModule = await import('./routes/router_timeline.js');
        app.use("/timeline", timelineModule.default);

        // 关注路由
        const followsModule = await import('./routes/router_follows.js');
        app.use("/follows", followsModule.default);

        // OAuth路由
        const oauthModule = await import('./routes/router_oauth.js');
        app.use("/oauth", oauthModule.default);

        // CacheKV路由
        const cachekvModule = await import('./routes/router_cachekv.js');
        app.use("/cachekv", cachekvModule.default);

        // 账户令牌路由
        const accountTokenModule = await import('./routes/router_accounttoken.js');
        app.use("/accounttoken", accountTokenModule.default);

        // CodeRun Runner路由
        const coderunRunnerModule = await import('./routes/admin/coderun_runner.js');
        app.use("/coderun", coderunRunnerModule.default);

        // Extensions路由
        const extensionsModule = await import('./routes/router_extensions.js');
        app.use("/extensions", extensionsModule.default);

        // 素材管理路由
        const assetsModule = await import('./routes/router_assets.js');
        app.use("/assets", assetsModule.default);

        // 统一认证路由
        const authModule = await import('./routes/router_auth.js');
        app.use("/auth", authModule.default);

        logger.info('[routes] 所有业务路由注册成功');
    } catch (error) {
        logger.error('[routes] 注册业务路由失败:', error);
        throw error;
    }
}