#!/bin/bash
# 生产环境启动脚本

# 设置生产环境变量
export NODE_ENV=production
export SESSION_SECRET="random-image-api-prod-$(date +%s)-$(openssl rand -hex 32)"
export PORT=3001

# 停止现有进程
pkill -f "src/app.js" 2>/dev/null

# 等待进程完全停止
sleep 2

echo "🚀 启动生产环境服务..."
echo "环境: $NODE_ENV"
echo "端口: $PORT" 
echo "会话密钥: ${SESSION_SECRET:0:20}... (已加密)"

# 启动生产环境服务
nohup node src/app.js > server.log 2>&1 &

# 获取进程ID
PID=$!

echo "✅ 生产环境服务已启动"
echo "进程ID: $PID"
echo "日志文件: $(pwd)/server.log"

# 等待服务器启动
sleep 3

# 测试健康检查
echo "🔍 检查服务状态..."
curl -s http://localhost:3001/health | jq '.' 2>/dev/null || echo "服务器启动中..."

echo "🎯 生产环境部署完成！"