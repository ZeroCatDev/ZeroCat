import logger from "../services/logger.js";
import zcconfig from "../services/config/zcconfig.js";
import jsonwebtoken from "jsonwebtoken";
import fs, {createReadStream} from "fs";

import {Router} from "express";
import {createHash} from "crypto";
import {prisma, S3update} from "../services/global.js";
import {needLogin} from "../middleware/auth.js";
import {getProjectById, getProjectFile} from "../controllers/projects.js";
import multer from "multer";
import { validateFileTypeFromContent, uploadFile } from "../services/assets.js";

var router = Router();

// 配置multer用于内存存储（scratch上传）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB限制
    files: 1
  }
});

// Migrated to use the global parseToken middleware

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
                license: true,
                thumbnail: true,
                default_branch: true,
                tags: true,
                name: true,
                star_count: true,
            },
        });
        logger.debug(project)
        if (!project) {
            res.status(404).send({
                code: 404,
                status: "404",
                message: "项目不存在或未发布",
            });
            return;
        }

        const author = await prisma.ow_users.findFirst({
            where: {id: project.authorid},
            select: {
                display_name: true,
                avatar: true,
                bio: true,
                motto: true,

            },
        });

        res.locals.is_author = project.authorid == res.locals.userid;

        res.json({
            ...project,
            author_display_name: author.display_name,
            author_images: author.avatar,
            author_bio: author.bio,
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
        res.locals.is_author = result.authorid == res.locals.userid;
        logger.debug(result);
        var project_token = jsonwebtoken.sign(
            {
                exp: Math.floor(Date.now() / 1000) + 60 * 5,
                data: {
                    type: "project",
                    action: "read",
                    issuer: await zcconfig.get("site.domain"),
                    projectid: result.id,
                    userid: res.locals.userid,
                },
            },
            await zcconfig.get("security.jwttoken")
        );
        logger.debug(project_token);
        var jsonscratch = {
            id: result.id,
            title: result.title,
            description: result.description,
            instructions: "ZeroCat社区",
            visibility: "visible",
            public: result.state == "public",
            comments_allowed: true,
            is_published: result.state == "public",
            author: {
                id: result.authorid,
                username: author.display_name,
                description: author.bio,
                scratchteam: author.id == 1,
                history: {
                    joined: author.createdAt,
                },
                profile: {
                    id: author.avatar,
                    images: {
                        "90x90": `${global.config["s3.staticurl"]}/user/${author.avatar}`,
                        "60x60": `${global.config["s3.staticurl"]}/user/${author.avatar}`,
                        "55x55": `${global.config["s3.staticurl"]}/user/${author.avatar}`,
                        "50x50": `${global.config["s3.staticurl"]}/user/${author.avatar}`,
                        "32x32": `${global.config["s3.staticurl"]}/user/${author.avatar}`,
                    },
                },
            },
            image: `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
            images: {
                "282x218": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
                "216x163": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
                "200x200": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
                "144x108": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
                "135x102": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
                "100x80": `${global.config["s3.staticurl"]}/scratch_slt/${result.id}`,
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
        logger.error(err);
        next(err);
    }
});

// 获取源代码
router.get("/project/:id", async (req, res, next) => {
    try {
        if (!req.params.id) {
            return res.status(400).send({status: "error", message: "缺少项目ID"});
        }
        let project_token;
        if (req.query.token) {
            try {
                logger.debug(await zcconfig.get("security.jwttoken"));
                project_token = jsonwebtoken.verify(
                    req.query.token,
                    await zcconfig.get("security.jwttoken")
                );
                logger.debug(project_token);
            } catch (err) {
                logger.debug("Error verifying project token:", err);
                return res
                    .status(200)
                    .send({
                        status: "error",
                        message: "无权访问此项目",
                        code: "AUTH_ERROR_LOGIN",
                    });
            }
            if (project_token.data.projectid != req.params.id) {
                logger.debug("1");
                return res
                    .status(200)
                    .send({
                        status: "error",
                        message: "无权访问此项目",
                        code: "AUTH_ERROR_LOGIN",
                    });
            }
            if (res.locals.userid && project_token.data.userid != res.locals.userid) {
                logger.debug("2");
                return res
                    .status(200)
                    .send({
                        status: "error",
                        message: "无权访问此项目",
                        code: "AUTH_ERROR_LOGIN",
                    });
            }
        } else {
            logger.debug("3");
            return res
                .status(200)
                .send({
                    status: "error",
                    message: "无权访问此项目",
                    code: "AUTH_ERROR_LOGIN",
                });
        }
        const project = await prisma.ow_projects.findFirst({
            where: {id: Number(project_token.data.projectid)},
        });

        if (!project) {
            return res
                .status(404)
                .send({status: "error", message: "作品不存在或无权打开"});
        }

        const source =
            project.authorid === project_token.data.userid
                ? project.devsource
                : project.source;
        const projectFile = await getProjectFile(source);

        if (projectFile?.source) {
            res.status(200).send(projectFile.source);
        } else {
            res
                .status(200)
                .send({
                    status: "error",
                    message: "无权访问此项目",
                    code: "AUTH_ERROR_LOGIN",
                });
        }
    } catch (err) {
        logger.error("Error fetching project source code:", err);
        next(err);
    }
});

//保存作品：缩略图
router.post(
    "/thumbnail/:projectid",
    needLogin,
    upload.single("file"),
    async (req, res, next) => {
        if (!req.file) {
            return res
                .status(400)
                .send({status: "error", message: "No file uploaded"});
        }

        try {
            const project = await getProjectById(Number(req.params.projectid));
            if (!project) {
                return res
                    .status(404)
                    .send({status: "error", code: "404", message: "作品不存在"});
            }
            if (project.authorid !== res.locals.userid) {
                return res
                    .status(200)
                    .send({
                        status: "error",
                        message: "无权访问此项目",
                        code: "AUTH_ERROR_LOGIN",
                    });
            }

            // 验证文件类型
            const fileTypeValidation = await validateFileTypeFromContent(req.file.buffer, req.file.mimetype);

            if (!fileTypeValidation.isValid) {
                logger.warn("缩略图文件类型验证失败:", {
                    originalname: req.file.originalname,
                    projectid: req.params.projectid,
                    frontendMimeType: req.file.mimetype,
                    detectedMimeType: fileTypeValidation.mimeType,
                    error: fileTypeValidation.error
                });
                return res.status(400).send({
                    status: "error",
                    message: fileTypeValidation.error || "不支持的文件类型，请上传图片"
                });
            }

            // 检查是否为图片类型
            if (!fileTypeValidation.mimeType.startsWith('image/')) {
                return res.status(400).send({
                    status: "error",
                    message: "缩略图必须是图片格式"
                });
            }

            // 使用新的图片处理逻辑，压缩为758x576，转webp，最高质量
            const { processImage, generateMD5, uploadToS3 } = await import("../services/assets.js");

            const imageResult = await processImage(req.file.buffer, {
                width: 758,
                height: 576,
                format: 'webp',
                quality: 100, // 最高质量
                sanitize: true
            });

            // 生成MD5哈希
            const md5Hash = generateMD5(imageResult.buffer);
            const thumbnailFilename = `${md5Hash}.webp`;

            // 上传到S3（新路径结构）
            const s3Key = `assets/${md5Hash.substring(0, 2)}/${md5Hash.substring(2, 4)}/${thumbnailFilename}`;
            await uploadToS3(imageResult.buffer, s3Key, 'image/webp');

            // 更新数据库项目的thumbnail字段
            await prisma.ow_projects.update({
                where: { id: Number(req.params.projectid) },
                data: { thumbnail: thumbnailFilename }
            });

            logger.debug("作品缩略图保存成功:"+ JSON.stringify({
                projectId: req.params.projectid,
                userId: res.locals.userid,
                thumbnailHash: md5Hash,
                originalSize: req.file.buffer.length,
                processedSize: imageResult.size,
                compressionRatio: imageResult.compressionRatio,
                dimensions: `${imageResult.width}x${imageResult.height}`
            }));

            res.status(200).send({
                status: "success",
                thumbnail: {
                    filename: thumbnailFilename,
                    hash: md5Hash,
                    size: imageResult.size,
                    dimensions: {
                        width: imageResult.width,
                        height: imageResult.height
                    }
                }
            });

        } catch (err) {
            logger.error("缩略图上传失败:", err);
            res
                .status(500)
                .send({status: "error", message: "缩略图处理失败"});
        }
    }
);

//新作品：保存作品素材
router.post(
    "/assets/:filename",
    needLogin,
    upload.single("file"),
    async (req, res, next) => {
        if (!req.file) {
            return res
                .status(400)
                .send({status: "error", message: "No file uploaded"});
        }

        try {
            // 验证文件类型
            const fileTypeValidation = await validateFileTypeFromContent(req.file.buffer, req.file.mimetype);

            if (!fileTypeValidation.isValid) {
                logger.warn("Scratch素材文件类型验证失败:", {
                    originalname: req.file.originalname,
                    filename: req.params.filename,
                    frontendMimeType: req.file.mimetype,
                    detectedMimeType: fileTypeValidation.mimeType,
                    error: fileTypeValidation.error
                });
                return res.status(400).send({
                    status: "error",
                    message: fileTypeValidation.error || "不支持的文件类型"
                });
            }

            // 使用检测到的文件类型信息更新文件对象
            req.file.detectedMimeType = fileTypeValidation.mimeType;
            req.file.detectedExtension = fileTypeValidation.extension;

            // 使用统一的文件上传函数，purpose 设为 'scratch'（不做任何处理）
            const result = await uploadFile(
                req.file,
                {
                    purpose: 'scratch',
                    category: 'scratch-assets',
                    tags: 'scratch'
                },
                res,
                req.ip,
                req.headers['user-agent']
            );

            if (!result.success) {
                return res.status(500).send({
                    status: "error",
                    message: "文件上传失败"
                });
            }

            logger.info("Scratch素材上传成功:", {
                userId: res.locals.userid,
                filename: req.params.filename,
                assetId: result.asset.id,
                md5: result.asset.md5,
                originalFormat: fileTypeValidation.mimeType,
                isExisting: result.isExisting
            });

            res.status(200).send({
                status: "success",
                asset: {
                    md5: result.asset.md5,
                    url: result.asset.url,
                    filename: req.params.filename,
                    mimeType: result.asset.mime_type,
                    size: result.asset.file_size
                }
            });

        } catch (err) {
            logger.error("Scratch asset upload error:", err);
            res
                .status(500)
                .send({status: "error", message: "文件上传失败"});
        }
    }
);

export default router;
