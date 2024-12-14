import { createLogger, format, transports } from "winston";
const { combine, timestamp, printf, errors, colorize } = format;
import DailyRotateFile from "winston-daily-rotate-file";
import { join } from "path";

// 获取环境变量中的日志级别和日志目录
const logLevel = process.env.LOG_LEVEL || "info";
const logDirectory = process.env.LOG_DIR || "logs";

// 自定义日志格式化方式
const logFormat = printf(({ level, message, timestamp, stack }) => {
  // 确保 message 是一个字符串类型，如果是对象，则使用 JSON.stringify()
  let logMessage = `${timestamp} ${level.padEnd(7)}: ${typeof message === 'object' ? JSON.stringify(message) : message}`;

  // 如果存在 stack（通常是错误对象的堆栈），确保它是字符串
  if (stack) {
    logMessage += `\n${typeof stack === 'object' ? JSON.stringify(stack) : stack}`;
  }

  return logMessage;
});

// 创建logger
const logger = createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // 自定义时间格式
    errors({ stack: true }), // 捕获错误堆栈信息
    logFormat // 自定义日志格式
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize(), // 控制台输出颜色

        logFormat // 输出格式
      ),
    }),

    // 错误日志文件：每天生成一个错误日志文件
    new DailyRotateFile({
      level: "error",
      filename: join(logDirectory, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),

    // 综合日志文件：记录所有日志
    new DailyRotateFile({
      level: logLevel,
      filename: join(logDirectory, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// 在开发环境中输出详细调试信息
if (process.env.NODE_ENV === "development") {
  logger.add(
    new transports.Console({
      level: "debug",
      format: combine(
        colorize(),
        timestamp(),
        logFormat
      ),
    })
  );
}

// 导出logger
export default logger;
