#!/bin/bash
# 随机图片API启动脚本

# 停止现有进程
pkill -f "src/app.js" 2>/dev/null

# 等待进程完全停止
sleep 2

# 进入项目目录
cd /root/data/docker_data/random-image-api

# 启动服务器
nohup node src/app.js > server.log 2>&1 &

# 获取进程ID
PID=$!

echo "Random Image API started with PID: $PID"
echo "Server log: /root/data/docker_data/random-image-api/server.log"
echo "Health check: curl http://localhost:3001/health"

# 等待服务器启动
sleep 3

# 测试健康检查
echo "Testing server health..."
curl -s http://localhost:3001/health | jq '.' 2>/dev/null || echo "Server not responding yet"

echo "Service startup complete!"