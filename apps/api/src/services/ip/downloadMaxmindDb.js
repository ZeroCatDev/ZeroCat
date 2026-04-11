#!/usr/bin/env node

/**
 * MaxMind 数据库下载工具
 *
 * 该脚本从数据库读取配置，下载MaxMind GeoIP数据库
 * 使用方法: node downloadMaxmindDb.js
 */

import fs, {createWriteStream} from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {promisify} from "util";
import axios from "axios";
import {pipeline} from "stream";
import {createGunzip} from "zlib";
import logger from "../logger.js";
import zcconfig from "../config/zcconfig.js";

import * as tar from "tar";

// 初始化常量
const streamPipeline = promisify(pipeline);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 固定的数据库目录和文件名
const DATA_DIR = path.resolve(__dirname, "../../../cache/ip");
const DB_FILE = path.join(DATA_DIR, "GeoLite2-City.mmdb");

// 基础下载配置（硬编码不易变的部分）
const DOWNLOAD_CONFIG = {
    downloadUrl: "https://download.maxmind.com/app/geoip_download",
    edition: "GeoLite2-City",
    suffix: "tar.gz",
};

// 用户配置（需要从数据库加载）
let USER_CONFIG = {
    enabled: false,
    licenseKey: "",
    accountId: "", // 新增：账户ID
};

/**
 * 从数据库加载MaxMind配置
 */
async function loadMaxmindConfigFromDB() {
    try {
        logger.info("[ip] 正在从数据库加载MaxMind配置...");

        // 仅加载必要配置
        const enabled = await zcconfig.get("maxmind.enabled");
        const licenseKey = await zcconfig.get("maxmind.license_key");
        const accountId = await zcconfig.get("maxmind.account_id");

        // 更新配置对象
        if (enabled !== null)
            USER_CONFIG.enabled = enabled === "true" || enabled === "1";
        if (licenseKey) USER_CONFIG.licenseKey = licenseKey;
        if (accountId) USER_CONFIG.accountId = accountId;

        logger.info("[ip] MaxMind配置已从数据库加载");
        return true;
    } catch (error) {
        logger.error("[ip] 从数据库加载MaxMind配置失败:", error);
        return false;
    }
}

/**
 * 下载数据库文件
 */
async function downloadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        logger.info("[ip] MaxMind数据库文件已存在，跳过下载...");
        return true;
    }
    if (!USER_CONFIG.licenseKey) {
        logger.error("[ip] 未设置MaxMind许可证密钥，无法下载数据库");
        return false;
    }

    if (!USER_CONFIG.accountId) {
        logger.error("[ip] 未设置MaxMind账户ID，无法下载数据库");
        return false;
    }

    logger.info("[ip] 开始下载MaxMind数据库...");

    // 构建下载URL (包含账户ID和许可证密钥)
    const url = `${DOWNLOAD_CONFIG.downloadUrl}?edition_id=${DOWNLOAD_CONFIG.edition}&license_key=${USER_CONFIG.licenseKey}&suffix=${DOWNLOAD_CONFIG.suffix}&account_id=${USER_CONFIG.accountId}`;
    logger.debug(`[ip] 下载URL: ${url}`);
    const tempFile = path.join(
        DATA_DIR,
        `${DOWNLOAD_CONFIG.edition}.${DOWNLOAD_CONFIG.suffix}`
    );

    // 确保data目录存在
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, {recursive: true});
    }

    // 下载文件
    logger.info(`[ip] 正在从MaxMind服务器下载数据库...`);

    // 使用axios下载并显示进度
    const {data, headers} = await axios({
        method: "get",
        url,
        responseType: "stream",
        validateStatus: (status) => status === 200,
        maxRedirects: 5,
        timeout: 60000, // 60秒超时
    });

    if (!data) {
        throw new Error("[ip] 下载失败: 未收到数据流");
    }

    // 获取文件总大小 (如果服务器提供)
    const totalSize = parseInt(headers["content-length"] || "0");
    let downloadedSize = 0;
    let lastLoggedPercent = -1;

    // 创建写入流
    const writer = createWriteStream(tempFile);

    // 监听下载进度
    data.on("data", (chunk) => {
        downloadedSize += chunk.length;

        // 计算下载百分比
        const percent = totalSize
            ? Math.floor((downloadedSize / totalSize) * 100)
            : 0;

        // 每10%输出一次日志，避免日志过多
        if (totalSize && percent % 10 === 0 && percent > lastLoggedPercent) {
            const downloadedMB = (downloadedSize / 1024 / 1024).toFixed(2);
            const totalMB = (totalSize / 1024 / 1024).toFixed(2);
            logger.info(`[ip] 下载进度: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`);

            // 在控制台也显示进度
            if (process.stdout.isTTY) {
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                process.stdout.write(
                    `下载进度: ${percent}% [${downloadedMB}MB / ${totalMB}MB]`
                );
            }

            lastLoggedPercent = percent;
        }
    });

    // 处理管道事件
    await new Promise((resolve, reject) => {
        data.pipe(writer);

        writer.on("finish", resolve);
        writer.on("error", reject);
        data.on("error", reject);
    });

    // 清除控制台最后一行并输出完成信息
    if (process.stdout.isTTY) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(
            `下载完成: 100% [${(downloadedSize / 1024 / 1024).toFixed(2)}MB]\n`
        );
    }

    logger.info(`[ip] 数据库下载完成，开始解压...`);

    // 解压文件
    await extractDatabase(tempFile);

    return true;
}

/**
 * 提取和安装数据库
 */
async function extractDatabase(tempFile) {
    try {
        // 创建一个临时解压目录
        const extractDir = path.join(DATA_DIR, "extract_tmp");
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, {recursive: true, force: true});
        }
        fs.mkdirSync(extractDir, {recursive: true});

        logger.info(`[ip] 解压文件到临时目录: ${extractDir}`);

        // 创建进度跟踪器
        const showProgress = process.stdout.isTTY;
        let extractStartTime = Date.now();

        // 启动进度动画
        let progressInterval;
        if (showProgress) {
            let dots = 0;
            progressInterval = setInterval(() => {
                dots = (dots + 1) % 4;
                const dotsStr = ".".repeat(dots);
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                const elapsedSec = ((Date.now() - extractStartTime) / 1000).toFixed(1);
                process.stdout.write(`[ip] 解压中${dotsStr.padEnd(3)} [${elapsedSec}秒]`);
            }, 500);
        }

        try {
            // 使用tar.x方法进行解压(推荐方式)
            await tar.x({
                file: tempFile,
                cwd: extractDir,
                gzip: true,
                onentry: showProgress
                    ? (entry) => {
                        // 更新最后解压的文件名
                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        const fileName = entry.path.split("/").pop();
                        const elapsedSec = (
                            (Date.now() - extractStartTime) /
                            1000
                        ).toFixed(1);
                        process.stdout.write(
                            `[ip] 解压: ${fileName.slice(0, 40).padEnd(40)} [${elapsedSec}秒]`
                        );
                    }
                    : undefined,
            });
        } catch (error) {
            // 如果上面的方法失败，尝试命令行方式
            logger.warn(`[ip] 使用tar.x解压失败: ${error.message}，尝试使用命令行解压...`);
            await extractWithCommandLine(tempFile, extractDir);
        } finally {
            // 清除进度显示
            if (progressInterval) {
                clearInterval(progressInterval);
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                const elapsedSec = ((Date.now() - extractStartTime) / 1000).toFixed(1);
                process.stdout.write(`[ip] 解压完成 [${elapsedSec}秒]\n`);
            }
        }

        // 查找解压后的数据库文件
        logger.info("[ip] 查找数据库文件...");
        const findDatabaseFile = (dir) => {
            try {
                const files = fs.readdirSync(dir);

                // 首先直接检查是否有mmdb文件
                const mmdbFile = files.find((file) => file.endsWith(".mmdb"));
                if (mmdbFile) {
                    return path.join(dir, mmdbFile);
                }

                // 否则递归检查子目录
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        const found = findDatabaseFile(fullPath);
                        if (found) return found;
                    }
                }
            } catch (err) {
                logger.error(`[ip] 查找数据库文件时出错: ${err.message}`);
            }

            return null;
        };

        // 查找数据库文件
        const dbSourceFile = findDatabaseFile(extractDir);

        if (!dbSourceFile) {
            throw new Error("[ip] 在解压文件中未找到数据库(.mmdb)文件");
        }

        // 复制到最终位置
        logger.info(`[ip] 找到数据库文件: ${dbSourceFile}，正在安装...`);

        // 如果是TTY，显示复制进度动画
        let copyInterval;
        if (showProgress) {
            let phase = 0;
            const phases = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
            copyInterval = setInterval(() => {
                phase = (phase + 1) % phases.length;
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                process.stdout.write(`[ip] 安装数据库文件... ${phases[phase]}`);
            }, 100);
        }

        try {
            fs.copyFileSync(dbSourceFile, DB_FILE);
        } finally {
            if (copyInterval) {
                clearInterval(copyInterval);
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                process.stdout.write(`[ip] 数据库文件安装完成 ✓\n`);
            }
        }

        // 清理临时文件
        logger.info("[ip] 清理临时文件...");
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, {recursive: true, force: true});
            }
        } catch (err) {
            logger.warn(`[ip] 清理临时文件失败: ${err.message}`);
        }

        logger.info(`[ip] MaxMind数据库已成功安装到: ${DB_FILE}`);
    } catch (error) {
        logger.error("[ip] 解压数据库文件失败:", error.message);
        throw error; // 重新抛出错误以便上层处理
    }
}

/**
 * 使用命令行工具进行解压
 */
async function extractWithCommandLine(tarFile, targetDir) {
    const {execSync} = await import("child_process");

    try {
        if (process.platform === "win32") {
            // Windows平台
            execSync(`tar -xzf "${tarFile}" -C "${targetDir}"`, {stdio: "ignore"});
        } else {
            // Linux/Mac平台
            execSync(`tar -xzf "${tarFile}" -C "${targetDir}"`, {stdio: "ignore"});
        }
    } catch (error) {
        logger.error(`[ip] 命令行解压失败: ${error.message}`);
        throw error;
    }
}

/**
 * 使用Node.js内置模块进行解压（已废弃，保留作为参考）
 */
async function extractWithNodeJs(tarFile, targetDir) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(tarFile)
            .on("error", (err) => reject(err))
            .pipe(createGunzip())
            .on("error", (err) => reject(new Error(`解压缩失败: ${err.message}`)))
            .pipe(tar.Extract({cwd: targetDir}))
            .on("error", (err) => reject(new Error(`提取失败: ${err.message}`)))
            .on("finish", () => resolve());
    });
}

/**
 * 主函数
 */
async function loadMaxmind() {
    // 从数据库加载配置
    await loadMaxmindConfigFromDB();

    // 检查必要配置
    if (!USER_CONFIG.licenseKey) {
        logger.error(
            "[ip] 错误: 未找到MaxMind许可证密钥。请在数据库中设置 maxmind.license_key 配置项。"
        );
        process.exit(1);
    }

    if (!USER_CONFIG.accountId) {
        logger.error(
            "[ip] 错误: 未找到MaxMind账户ID。请在数据库中设置 maxmind.account_id 配置项。"
        );
        process.exit(1);
    }

    // 开始下载
    logger.info(`[ip] 开始下载MaxMind GeoIP数据库...`);
    const success = await downloadDatabase();

    if (success) {
        logger.info("[ip] ✓ MaxMind GeoIP数据库下载并更新成功！");
    } else {
        logger.error("[ip] ✗ MaxMind GeoIP数据库下载或更新失败！");
    }
}

// 如果直接运行此脚本，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
    loadMaxmind();
}

// 导出关键功能以便其他模块调用
export default {
    loadMaxmindConfigFromDB,
    downloadDatabase,
    extractDatabase,
    loadMaxmind,
};
