import logger from "../services/logger.js";
import fs from "fs";

//个人中心
import { Router } from "express";
var router = Router();
import { createReadStream } from "fs";
import { createHash } from "crypto";
//功能函数集
import { S3update, checkhash, hash, prisma } from "../services/global.js";
//数据库
import multer from "multer";
import { createEvent } from "../controllers/events.js";

const upload = multer({ dest: "../../cache/usercontent" });

// Migrated to use the global parseToken middleware

router.post("/set/avatar", upload.single("zcfile"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ status: "error", message: "No file uploaded" });
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
        data: { avatar: hashValue },
      });
      res.status(200).send({ status: "success", message: "头像上传成功" });
    });

    chunks.on("error", (err) => {
      logger.error("Error processing file upload:", err);
      res.status(500).send({ status: "error", message: "图片上传失败" });
    });
  } catch (err) {
    logger.error("Unexpected error:", err);
    res.status(500).send({ status: "error", message: "图片上传失败" });
  }
});

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    logger.error("Unexpected end of form: ", err);
    res.status(400).send({ status: "error", message: "数据传输异常" });
  } else {
    next(err);
  }
});

//修改个人信息
router.post("/set/userinfo", async (req, res) => {
  try {
    const updateData = {
      display_name: req.body.display_name,
      bio: req.body.bio,
      bio: req.body.bio,
      location: req.body.location,
      region: req.body.region,
      sex: req.body.sex,
      url: req.body.url,
      birthday: req.body.birthday ? new Date(req.body.birthday) : undefined
    };

    // 处理custom_status (表情和状态文本)
    if (req.body.custom_status) {
      try {
        updateData.custom_status = JSON.parse(req.body.custom_status);
      } catch (e) {
        return res.status(400).send({
          status: "error",
          message: "custom_status 必须是有效的 JSON 格式"
        });
      }
    }

    // 处理featured_projects (精选项目ID)
    if (req.body.featured_projects) {
      const featuredProjectId = parseInt(req.body.featured_projects);
      if (isNaN(featuredProjectId)) {
        return res.status(400).send({
          status: "error",
          message: "featured_projects 必须是有效的数字"
        });
      }

      // 验证项目是否存在且属于当前用户
      const project = await prisma.ow_projects.findFirst({
        where: {
          id: featuredProjectId,
          authorid: res.locals.userid
        }
      });

      if (!project) {
        return res.status(400).send({
          status: "error",
          message: "指定的项目不存在或不属于当前用户"
        });
      }

      updateData.featured_projects = featuredProjectId;
    }

    // 移除所有undefined的字段
    Object.keys(updateData).forEach(key =>
      updateData[key] === undefined && delete updateData[key]
    );

    await prisma.ow_users.update({
      where: { id: res.locals.userid },
      data: updateData
    });

    // 添加个人资料更新事件
    await createEvent(
      "user_profile_update",
      res.locals.userid,
      "user",
      res.locals.userid,
      {
        event_type: "user_profile_update",
        actor_id: res.locals.userid,
        target_type: "user",
        target_id: res.locals.userid,
        update_type: "profile_update",
        updated_fields: Object.keys(updateData),
        old_value: null,
        new_value: JSON.stringify(updateData)
      }
    );

    res.status(200).send({ status: "success", message: "个人信息修改成功" });
  } catch (error) {
    logger.error("Error updating user info:", error);
    res.status(500).send({ status: "error", message: "修改个人信息失败" });
  }
});

//修改用户名
router.post("/set/username", async (req, res) => {
  await prisma.ow_users.update({
    where: { id: res.locals.userid },
    data: {
      username: req.body.username,
    },
  });
  res.locals.username = req.body.username;

  res.status(200).send({ status: "success", message: "用户名修成成功" });
});

//修改密码：动作
router.post("/set/pw", async (req, res) => {
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
