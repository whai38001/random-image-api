#!/bin/bash

# 随机图片API启动脚本
# 默认端口3001，避免占用80和443端口

cd "$(dirname "$0")"

echo "正在启动随机图片API服务..."
echo "项目目录: $(pwd)"

if [ ! -f "package.json" ]; then
    echo "错误: 未找到package.json文件"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

export PORT=3001
export NODE_ENV=production

echo "服务启动中，端口: $PORT"
echo "后台管理地址: http://localhost:$PORT/admin"
echo "API地址: http://localhost:$PORT/api/random"
echo ""
echo "按 Ctrl+C 停止服务"

npm start