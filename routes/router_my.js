import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import fs from "fs";

//个人中心
import { Router } from "express";
var router = Router();
import { createReadStream } from "fs";
import { createHash } from "crypto";
//功能函数集
import { S3update, checkhash, hash, prisma } from "../utils/global.js";
//数据库
import geetestMiddleware from "../middleware/geetest.js";
import multer from "multer";

const upload = multer({ dest: "./usercontent" });

router.all("*", function (req, res, next) {
  //限定访问该模块的权限：必须已登录
  if (!res.locals.login) {
    //未登录时，跳转到登录界面
    res.redirect("/account/login");
    return;
  }
  next();
});

router.post("/set/avatar", geetestMiddleware, upload.single('zcfile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ status: "error", message: "No file uploaded" });
  }

  try {
    const file = req.file;
    const hash = createHash("md5");
    const chunks = createReadStream(file.path);

    chunks.on("data", (chunk) => {
      if (chunk) hash.update(chunk);
    });

    chunks.on("end", async () => {
      const hashValue = hash.digest("hex");
      const fileBuffer = await fs.promises.readFile(file.path);
      await S3update(`user/${hashValue}`, fileBuffer);
      await prisma.ow_users.update({
        where: { id: res.locals.userid },
        data: { images: hashValue },
      });
      res.status(200).send({ status: "success", message: "Avatar updated successfully" });
    });

    chunks.on("error", (err) => {
      logger.error("Error processing file upload:", err);
      res.status(500).send({ status: "error", message: "File processing error" });
    });
  } catch (err) {
    logger.error("Unexpected error:", err);
    res.status(500).send({ status: "error", message: "Internal server error" });
  }
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    logger.error("Unexpected end of form: ", err);
    res.status(400).send({ status: "error", message: "表单意外结束" });
  } else {
    next(err);
  }
});

//修改个人信息
router.post("/set/userinfo", geetestMiddleware, async (req, res) => {
  await prisma.ow_users.update({
    where: { id: res.locals.userid },
    data: {
      display_name: req.body["display_name"],
      motto: req.body["aboutme"],
      sex: req.body["sex"],
      birthday: new Date(`2000-01-01 00:00:00`),
    },
  });
  res.locals["display_name"] = req.body["display_name"];

  res.status(200).send({ status: "个人信息修成成功" });
});

//修改用户名
router.post("/set/username", geetestMiddleware, async (req, res) => {
  await prisma.ow_users.update({
    where: { id: res.locals.userid },
    data: {
      username: req.body.username,
    },
  });
  res.locals["username"] = req.body["username"];

  res.status(200).send({ status: "用户名修成成功" });
});

//修改密码：动作
router.post("/set/pw", geetestMiddleware, async (req, res) => {
  const USER = await prisma.ow_users.findUnique({
    where: { id: res.locals.userid },
  });
  if (!USER) {
    return res.status(200).send({ status: "错误", message: "用户不存在" });
  }
  if (checkhash(req.body["oldpw"], USER.password) == false) {
    return res.status(200).send({ status: "错误", message: "旧密码错误" });
  }
  const newPW = hash(req.body["newpw"]);
  await prisma.ow_users.update({
    where: { id: res.locals.userid },
    data: { password: newPW },
  });
  res.status(200).send({ status: "success", message: "密码修改成功" });
});

export default router;
