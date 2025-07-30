# 使用轻量且有社区支持的 Node 官方镜像
FROM node:20.19.2-alpine

# 设置作者信息
LABEL author="wuyuan"

# 设置工作目录
WORKDIR /app

# 只复制 package.json 和 lock 文件先安装依赖
COPY package*.json ./

# 使用缓存加速构建；锁版本保证一致性
RUN npm install

# 复制项目文件
COPY . .

# 设置环境变量（可选）
ENV NODE_ENV=production

# 容器对外暴露的端口
EXPOSE 3000

# 使用 exec form，避免 shell 问题
CMD ["npm", "run", "start"]
