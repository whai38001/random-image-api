# API 文档

详细的API接口说明和使用示例。

## 📋 认证

大部分API端点需要认证。使用以下端点获取访问令牌：

### POST /auth/login

用户登录获取会话

**请求:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**响应:**
```json
{
  "success": true,
  "message": "登录成功",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

## 🖼️ 图片API

### GET /api/random

获取随机图片

**参数:**
- `category` (可选) - 图片分类: landscape, anime, beauty, nature, city, art
- `orientation` (可选) - 图片方向: landscape (横屏), portrait (竖屏)

**示例:**
```bash
# 获取随机图片
curl http://localhost:3001/api/random

# 获取随机风景图片
curl http://localhost:3001/api/random?category=landscape

# 获取随机竖屏图片
curl http://localhost:3001/api/random?orientation=portrait
```

**响应:**
```
HTTP/1.1 302 Found
Location: https://example.com/image.jpg
```

### GET /api/images

获取所有图片（分页）

**参数:**
- `page` (可选, 默认: 1) - 页码
- `limit` (可选, 默认: 12) - 每页数量
- `category` (可选) - 筛选分类
- `orientation` (可选) - 筛选方向

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "image1.jpg",
      "original_name": "Beautiful Landscape.jpg",
      "category": "landscape",
      "orientation": "landscape",
      "is_local": true,
      "url": null,
      "created_at": "2025-07-27T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 100,
    "totalPages": 9,
    "hasPrev": false,
    "hasNext": true
  }
}
```

### POST /api/images

上传新图片

**FormData参数:**
- `image` (可选) - 上传的图片文件
- `url` (可选) - 图片URL
- `category` (必需) - 图片分类
- `orientation` (必需) - 图片方向

**示例:**
```bash
# 上传本地图片
curl -X POST http://localhost:3001/api/images \
  -F "image=@/path/to/image.jpg" \
  -F "category=landscape" \
  -F "orientation=landscape"

# 添加URL图片
curl -X POST http://localhost:3001/api/images \
  -F "url=https://example.com/image.jpg" \
  -F "category=anime" \
  -F "orientation=portrait"
```

### PUT /api/images/:id

更新图片信息

**参数:**
- `id` - 图片ID

**FormData参数:**
- `category` (可选) - 新分类
- `orientation` (可选) - 新方向
- `url` (可选) - 新URL（仅对URL图片有效）

### DELETE /api/images/:id

删除图片

**参数:**
- `id` - 图片ID

## 📊 统计API

### GET /api/stats

获取图片统计信息

**响应:**
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "landscape": 900,
    "portrait": 600,
    "categories": 6,
    "byCategory": {
      "landscape": 900,
      "anime": 200,
      "beauty": 150,
      "nature": 100,
      "city": 100,
      "art": 50
    }
  }
}
```

## 🔍 搜索API

### GET /api/search

搜索图片

**参数:**
- `query` (可选) - 搜索关键词
- `category` (可选) - 分类筛选
- `orientation` (可选) - 方向筛选
- `type` (可选) - 类型筛选 (local, url)
- `sort` (可选) - 排序方式 (newest, oldest, random)
- `page` (可选, 默认: 1) - 页码
- `limit` (可选, 默认: 12) - 每页数量

**响应:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...},
  "meta": {
    "query": "search term",
    "filters": {
      "category": "landscape"
    }
  }
}
```

### GET /api/search/suggestions

获取搜索建议

**参数:**
- `q` (必需) - 搜索关键词
- `limit` (可选, 默认: 5) - 建议数量

## 👤 用户API

### GET /auth/users

获取所有用户（需要管理员权限）

### POST /auth/users

创建新用户（需要管理员权限）

### DELETE /auth/users/:id

删除用户（需要管理员权限）

### PATCH /auth/users/:id/toggle-status

切换用户状态（启用/禁用）

## 🔐 系统API

### GET /system

获取系统配置（需要管理员权限）

### PUT /system/batch

批量更新系统配置（需要管理员权限）

### GET /system/public/registration-status

获取公开的注册状态信息

## 🩺 健康检查

### GET /health

系统健康检查端点

**响应:**
```json
{
  "status": "healthy",
  "issues": [],
  "metrics": {
    "memory": {...},
    "cpu": {...},
    "uptime": 120,
    "activeConnections": 2
  }
}
```

## 📈 监控API

### GET /monitoring/metrics

获取系统性能指标（Prometheus格式）