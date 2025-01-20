import logger from "../utils/logger.js";
import configManager from "../utils/configManager.js";
import jsonwebtoken from "jsonwebtoken";
import fs from "fs";

import { Router } from "express";
var router = Router();
import { writeFile, exists,createReadStream } from "fs";
import { createHash } from "crypto";
import { prisma, S3update } from "../utils/global.js";
import { needlogin } from "../middleware/auth.js";
import { getProjectFile,getProjectById } from "../controllers/projects.js";
import multer from "multer";
const upload = multer({ dest: "./usercontent" });

router.all("*", function (req, res, next) {
  next();
});



router.get("/projectinfo", async function (req, res, next) {
  try {
    const project = await prisma.ow_projects.findFirst({
      where: {
        id: Number(req.query.id),
        state: "public",
        type: "scratch",
      },
      select: {
        id: true,
        authorid: true,
        time: true,
        view_count: true,
        like_count: true,
        favo_count: true,
        title: true,
        state: true,
        description: true,
        licence: true,
        tags: true,
      },
    });

    if (!project) {
      res.locals.tip = { opt: "flash", message: "项目不存在或未发布" };
      res.status(404).send({
        code: 404,
        status: "404",
        message: "项目不存在或未发布",
      });
      return;
    }

    const author = await prisma.ow_users.findFirst({
      where: { id: project.authorid },
      select: {
        display_name: true,
        images: true,
        motto: true,
      },
    });

    res.locals["is_author"] =
      project.authorid == res.locals.userid ? true : false;

    res.json({
      ...project,
      author_display_name: author.display_name,
      author_images: author.images,
      author_motto: author.motto,
    });
  } catch (err) {
    next(err);
  }
});


router.get("/projectinfo2", async function (req, res, next) {
  try {
    var result = await prisma.ow_projects.findFirst({
      where: {
        id: Number(req.query.id),
      },
    });
    var author = await prisma.ow_users.findFirst({
      where: {
        id: result.authorid,
      },
    });
    res.locals["is_author"] =
      result.authorid == res.locals.userid ? true : false;
    logger.debug(result);
    var resulttype = {
      id: 50,
      type: "scratch",
      licence: "no",
      authorid: 89,
      teacherid: 0,
      state: "public",
      view_count: 119,
      like_count: 0,
      favo_count: 0,
      time: "2024-06-22T10:32:42.000Z",
      title: "title",
      description: "description",
      source: "source",
      history: true,
      devenv: true,
      devsource: "devsource",
      tags: "",
    };
    var project_token = jsonwebtoken.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
        data: {
          type: "project",
          action: "read",
          issuer: await configManager.getConfig("site.domain"),
          projectid: result.id,
          userid: res.locals.userid,
        },
      },
      await configManager.getConfig("security.jwttoken")
    );
    logger.debug(project_token);
    var jsonscratch = {
      id: result.id,
      title: result.title,
      description: result.description,
      instructions: "ZeroCat社区",
      visibility: "visible",
      public: result.state == "public" ? true : false,
      comments_allowed: true,
      is_published: result.state == "public" ? true : false,
      author: {
        id: result.authorid,
        username: author.display_name,
        scratchteam: author.id == 1 ? true : false,
        history: {
          joined: author.createdAt,
        },
        profile: {
          id: null,
          images: {
            "90x90": `${global.config["urls.static"]}/user/${author.images}`,
            "60x60": `${global.config["urls.static"]}/user/${author.images}`,
            "55x55": `${global.config["urls.static"]}/user/${author.images}`,
            "50x50": `${global.config["urls.static"]}/user/${author.images}`,
            "32x32": `${global.config["urls.static"]}/user/${author.images}`,
          },
        },
      },
      image: `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      images: {
        "282x218": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "216x163": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "200x200": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "144x108": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "135x102": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
        "100x80": `${global.config["urls.static"]}/scratch_slt/${result.id}`,
      },
      history: {
        created: result.createdAt,
        modified: result.createdAt,
        shared: result.createdAt,
      },
      stats: {
        views: result.view_count,
        loves: 0,
        favorites: 0,
        remixes: 0,
      },
      remix: {
        parent: null,
        root: null,
      },
      project_token,
    };
    ////logger.logger.debug(SCRATCH[0]);
    res.json(jsonscratch);
  } catch (err) {
    next(err);
  }
});

// 获取源代码
router.get("/project/:id", async (req, res, next) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ status: "error", message: "缺少项目ID" });
    }
    let project_token;
    if (req.query.token) {
      try {
        logger.debug(await configManager.getConfig("security.jwttoken"));
        project_token = jsonwebtoken.verify(
          req.query.token,
          await configManager.getConfig("security.jwttoken")
        );
        logger.debug(project_token);
      } catch (err) {
        logger.debug("Error verifying project token:", err);
        return res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
      }
      if (project_token.data.projectid != req.params.id) {
        logger.debug("1");
        return res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
      }
      if (res.locals.userid && project_token.data.userid != res.locals.userid) {
        logger.debug("2");
        return res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
      }
    } else {
      logger.debug("3");
      return res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
    }
    const project = await prisma.ow_projects.findFirst({
      where: { id: Number(project_token.data.projectid) },
    });

    if (!project) {
      return res.status(404).send({ status: "error", message: "作品不存在或无权打开" });
    }

    const source =
      project.authorid === project_token.data.userid
        ? project.devsource
        : project.source;
    const projectFile = await getProjectFile(source);

    if (projectFile?.source) {
      res.status(200).send(projectFile.source);
    } else {
      res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
    }
  } catch (err) {
    logger.error("Error fetching project source code:", err);
    next(err);
  }
});

//保存作品：缩略图
router.post("/thumbnail/:projectid", upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).send({ status: "error", message: "No file uploaded" });
  }

  try {
    const project = await getProjectById(Number(req.params.projectid));
    if (!project) {
      return res.status(404).send({ status: "error", code: "404", message: "作品不存在" });
    }
    if (project.authorid !== res.locals.userid) {
      return res.status(200).send({ status: "error", message: "无权访问此项目",code:"AUTH_ERROR_LOGIN" });
    }

    const file = req.file;
    const hash = createHash("md5");
    const chunks = createReadStream(file.path);

    chunks.on("data", (chunk) => {
      if (chunk) hash.update(chunk);
    });

    chunks.on("end", async () => {
      const hashValue = hash.digest("hex");
      const fileBuffer = await fs.promises.readFile(file.path);
      await S3update(`scratch_slt/${req.params.projectid}`, fileBuffer);
      res.status(200).send({ status: "success" });
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

//新作品：保存作品素材
router.post("/assets/:filename", needlogin, upload.single('file'), async (req, res, next) => {
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
      const ext = req.params.filename.split('.').pop();
      const newFilename = `${hashValue}.${ext}`;
      const fileBuffer = await fs.promises.readFile(file.path);
      await S3update(`material/asset/${newFilename}`, fileBuffer);
      res.status(200).send({ status: "success" });
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

export default router;
