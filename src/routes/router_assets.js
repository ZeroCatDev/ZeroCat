import logger from "../services/logger.js";
import { Router } from "express";
import { needLogin } from "../middleware/auth.js";
import multer from "multer";
import {
  validateFileTypeFromContent,
  uploadFile,
  processFileUpload,
  processSimpleImageUpload,
  getAssetsList,
  getAssetDetails,
  getAssetStats,
  handleAssetUpload
} from "../services/assets.js";
import { prisma } from "../services/prisma.js";

const router = Router();

// 配置multer用于文件上传 - 使用更专业的配置
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB限制
    files: 1, // 限制单次上传文件数量
    fieldSize: 2 * 1024 * 1024, // 限制字段大小2MB
    fieldNameSize: 100, // 限制字段名长度
    fields: 10, // 限制字段数量
    parts: 20 // 限制总部件数量
  },
  fileFilter: (req, file, cb) => {
    try {
      // 确保文件名是UTF-8编码
      if (file.originalname) {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

        // 验证文件名长度和字符
        if (file.originalname.length > 255) {
          return cb(new Error("文件名过长"), false);
        }

        // 检查文件名中的危险字符
        const dangerousChars = /[<>:"|?*\x00-\x1f]/;
        if (dangerousChars.test(file.originalname)) {
          return cb(new Error("文件名包含非法字符"), false);
        }
      }

      // 基本文件大小预检查
      if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 50 * 1024 * 1024) {
        return cb(new Error("文件大小超过限制"), false);
      }

      // 在fileFilter阶段先允许所有文件通过，真正的验证在处理阶段进行
      // 这样可以基于文件内容而不是MIME类型进行验证
      cb(null, true);
    } catch (error) {
      logger.error("文件过滤器错误:", error);
      cb(error, false);
    }
  },
  // 确保以二进制模式处理文件
  preservePath: false,
  // 添加错误处理
  onError: (err, next) => {
    logger.error("Multer错误:", err);
    next(err);
  }
});

// 上传素材
router.post("/upload", needLogin, upload.single("file"), async (req, res) => {
  const { tags, category } = req.body;

  const uploadResult = await handleAssetUpload(req, res, {
    purpose: 'general',
    category: category || 'general',
    tags: tags || '',
    errorMessage: '素材上传失败',
    successCallback: async (req, res, result) => {
      logger.debug("文件上传信息:")
      logger.debug( {
        originalname: req.file.originalname,
        frontendMimeType: req.file.mimetype,
        detectedMimeType: req.file.detectedMimeType,
        detectedExtension: req.file.detectedExtension,
        size: req.file.buffer.length,
        encoding: req.file.encoding
      });
      return null;
    }
  });

  if (!uploadResult.success) {
    return res.status(uploadResult.status).json({
      error: uploadResult.error,
      ...(uploadResult.details && { details: uploadResult.details })
    });
  }

  res.json(uploadResult.result);
});

// 原始文件上传接口（不做任何处理，保持原始格式）
router.post("/upload-raw", needLogin, upload.single("file"), async (req, res) => {
  const { tags, category } = req.body;

  const uploadResult = await handleAssetUpload(req, res, {
    purpose: 'scratch', // 使用scratch模式，不对文件做任何处理
    category: category || 'raw',
    tags: tags || '',
    errorMessage: '原始文件上传失败',
    successCallback: async (req, res, result) => {
      logger.debug("原始文件上传成功:", {
        originalname: req.file.originalname,
        detectedMimeType: req.file.detectedMimeType,
        detectedExtension: req.file.detectedExtension,
        size: req.file.buffer.length,
        md5: result.asset.md5
      });
      return null;
    }
  });

  if (!uploadResult.success) {
    return res.status(uploadResult.status).json({
      error: uploadResult.error,
      ...(uploadResult.details && { details: uploadResult.details })
    });
  }

  res.json(uploadResult.result);
});

// 简化的图片上传接口（仅支持图片，自动转PNG，无安全检查）
router.post("/image-upload", needLogin, upload.single("file"), async (req, res) => {
  const { quality = 80, tags, category } = req.body;

  try {
    // 使用processSimpleImageUpload保持原有的简化图片处理逻辑
    const result = await processSimpleImageUpload(
      req.file,
      { quality, tags, category },
      res,
      req.ip,
      req.headers['user-agent']
    );

    res.json(result);
  } catch (error) {
    logger.error("简化图片上传失败:", error);

    // 根据错误类型返回不同的错误信息
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: "文件大小超过限制" });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: "意外的文件字段" });
    } else if (error.message.includes('不是有效的图片文件')) {
      return res.status(400).json({ error: "只支持图片文件" });
    }

    res.status(500).json({ error: "图片上传失败", details: error.message });
  }
});

// 获取素材列表
router.get("/list", needLogin, async (req, res) => {
  try {
    const { page, limit, category, search, sortBy, sortOrder } = req.query;

    const result = await getAssetsList({
      page, limit, category, search, sortBy, sortOrder
    });

    res.json({
      success: true,
      data: result.assets,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error("获取素材列表失败:", error);
    res.status(500).json({ error: "获取素材列表失败" });
  }
});

// 获取素材详情
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await getAssetDetails(parseInt(id));

    if (!asset) {
      return res.status(404).json({ error: "素材不存在" });
    }

    res.json({
      success: true,
      asset
    });

  } catch (error) {
    logger.error("获取素材详情失败:", error);
    res.status(500).json({ error: "获取素材详情失败" });
  }
});

// 获取素材统计信息
router.get("/stats/overview", async (req, res) => {
  try {
    const stats = await getAssetStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error("获取素材统计失败:", error);
    res.status(500).json({ error: "获取素材统计失败" });
  }
});
router.post("/scratch/check", async (req, res) => {
  try {
    let files = [];
    if (req.body.files) {
      files = req.body.files
    } else {
      files = req.body;
    }
    const result = await prisma.ow_assets.findMany({
      where: {
        md5: {
          in: files
        }
      }
    })
    res.json({
      success: true,
      data: result.map(item => item.md5)
    })
  } catch (error) {
    logger.error("检查scratch文件失败:", error);
    res.status(500).json({ error: "检查scratch文件失败" });
  }
});
export default router;