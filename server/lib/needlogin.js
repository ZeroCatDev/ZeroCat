import express from "express";

const app = express();

// 登录检查中间件
app.use((req, res, next) => {
  if (!res.locals.login) {
    // 未登录，返回401 Unauthorized状态码
    return res.status(401).send({ status: "0", msg: "请先登录以继续操作" });
  }
  next(); // 已登录，继续处理请求
});

export default app;
