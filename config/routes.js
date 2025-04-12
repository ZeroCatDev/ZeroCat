import express from 'express';
import logger from '../utils/logger.js';
import paths from './constants/paths.js';
import configManager from '../utils/configManager.js';

/**
 * 配置应用路由
 * @param {express.Application} app Express应用实例
 */
export async function configureRoutes(app) {
  // 加载配置信息到全局
  await configManager.loadConfigsFromDB();
  logger.info('配置信息已加载到全局');

  // 设置视图目录和引擎
  app.set("env", process.cwd());
  app.set("data", paths.DATA_DIR);
  app.set("views", paths.VIEWS_DIR);
  app.set("view engine", "ejs");

  // 首页路由
  app.get("/", (req, res) => {
    res.render("index.ejs");
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
    res.render("scratchtool.ejs");
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
    // 账户管理路由
    const accountModule = await import('../routes/router_account.js');
    app.use("/account", accountModule.default);

    // 个人中心路由
    const myModule = await import('../routes/router_my.js');
    app.use("/my", myModule.default);

    // 搜索API路由
    const searchModule = await import('../routes/router_search.js');
    app.use("/searchapi", searchModule.default);

    // Scratch路由
    const scratchModule = await import('../routes/router_scratch.js');
    app.use("/scratch", scratchModule.default);

    // API路由
    const apiModule = await import('../routes/router_api.js');
    app.use("/api", apiModule.default);

    // 项目列表路由
    const projectlistModule = await import('../routes/router_projectlist.js');
    app.use("/projectlist", projectlistModule.default);

    // 项目路由
    const projectModule = await import('../routes/router_project.js');
    app.use("/project", projectModule.default);

    // 评论路由
    const commentModule = await import('../routes/router_comment.js');
    app.use("/comment", commentModule.default);

    // 用户路由
    const userModule = await import('../routes/router_user.js');
    app.use("/user", userModule.default);

    // 时间线路由
    const timelineModule = await import('../routes/router_timeline.js');
    app.use("/timeline", timelineModule.default);

    logger.info('所有业务路由注册成功');
  } catch (err) {
    logger.error('注册业务路由失败:', err);
  }
}