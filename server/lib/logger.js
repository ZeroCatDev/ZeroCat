const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, errors, colorize } = format;
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// 获取环境变量中的日志级别和日志目录
const logLevel = process.env.LOG_LEVEL || "info";
const logDirectory = process.env.LOG_DIR || "logs";

// 自定义日志格式化方式
const logFormat = printf(({ level, message, timestamp, stack }) => {
  let logMessage = `${timestamp} ${level.padEnd(7)}: ${message}`;
  if (stack) {
    logMessage += `\n${stack}`;
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
      filename: path.join(logDirectory, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),

    // 综合日志文件：记录所有日志
    new DailyRotateFile({
      level: logLevel,
      filename: path.join(logDirectory, "combined-%DATE%.log"),
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
        printf(
          ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
        )
      ),
    })
  );
}

// 导出logger
module.exports = logger;
