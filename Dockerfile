# 🐳 多阶段构建优化的Dockerfile

# ========================
# 构建阶段
# ========================
FROM node:18-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci --only=production && npm cache clean --force

# ========================
# 生产阶段  
# ========================
FROM node:18-alpine AS production

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# 安装运行时依赖
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules

# 复制应用代码
COPY --chown=nodeuser:nodejs . .

# 创建必要的目录
RUN mkdir -p /app/public/uploads/thumbnails/{small,medium,large} \
    /app/config \
    /app/logs && \
    chown -R nodeuser:nodejs /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 切换到非root用户
USER nodeuser

# 启动应用
CMD ["npm", "start"]