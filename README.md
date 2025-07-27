# 🎨 Random Image API

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

一个功能完整的随机图片API服务，支持图片分类、方向筛选、后台管理和用户认证。

## ✨ 特性

### 🚀 核心功能
- **随机图片API**: 支持分类和方向筛选的高性能图片服务
- **多格式支持**: 直接图片访问和JSON格式数据
- **图片管理**: 支持本地上传和URL链接两种方式
- **智能分类**: 6大分类（风景、动漫、美女、自然、城市、艺术）
- **方向支持**: 横屏/竖屏自动识别和筛选

### 🎯 管理功能
- **缩略图预览**: 自动生成200x200高质量缩略图
- **批量操作**: 支持批量分类修改和删除
- **分页管理**: 高效分页加载，支持大量图片
- **数据统计**: 实时统计各分类图片数量

### 🔒 安全特性
- **用户认证**: JWT + Session双重认证
- **验证码保护**: SVG验证码防止自动化攻击
- **访问控制**: IP/域名黑白名单管理
- **频率限制**: API请求频率限制
- **安全头部**: Helmet安全中间件

### ⚡ 性能优化
- **数据库索引**: 12个关键索引优化查询性能
- **CORS支持**: 默认支持跨域访问
- **缓存策略**: 图片缓存和API响应优化
- **健康检查**: 内置健康检查端点

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite3 + 优化索引
- **认证**: JWT + bcryptjs
- **图片处理**: Sharp (缩略图生成)
- **文件上传**: Multer
- **安全**: Helmet + CORS + Rate Limiting
- **前端**: 原生JavaScript + 响应式CSS

## 📦 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/random-image-api.git
cd random-image-api
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务**

**开发环境:**
```bash
# 开发模式启动
./start-server.sh

# 或直接启动
npm start
```

**生产环境:**
```bash
# 生产环境启动 (推荐)
./start-production.sh

# 手动设置生产环境
export NODE_ENV=production
export SESSION_SECRET=your-custom-secret-key
node src/app.js
```

4. **访问服务**
- API文档: http://localhost:3001/
- 管理后台: http://localhost:3001/admin
- 登录页面: http://localhost:3001/login

### 默认账户
- 用户名: `admin`
- 密码: `admin123`

## 📖 API 文档

### 随机图片接口

#### 获取随机图片（直接返回图片）
```http
GET /api/random?category=beauty&orientation=portrait
```

#### 获取随机图片（JSON格式）
```http
GET /api/random/json?category=landscape&orientation=landscape
```

**参数说明:**
- `category` (可选): `landscape`, `anime`, `beauty`, `nature`, `city`, `art`
- `orientation` (可选): `landscape`, `portrait`

**响应示例:**
```json
{
  "id": 123,
  "filename": "image.jpg",
  "category": "beauty",
  "orientation": "portrait",
  "created_at": "2025-01-27 12:00:00",
  "url": "/api/images/123"
}
```

### 图片管理接口

#### 获取图片列表
```http
GET /api/images?page=1&limit=12&category=landscape
```

#### 上传图片
```http
POST /api/images
Content-Type: multipart/form-data

{
  "image": file,
  "category": "beauty",
  "orientation": "portrait"
}
```

#### 更新图片
```http
PUT /api/images/:id
```

#### 删除图片
```http
DELETE /api/images/:id
```

## 🎨 管理后台

### 功能特色

1. **仪表盘统计**
   - 总图片数量
   - 分类分布
   - 方向统计

2. **图片管理**
   - 缩略图预览
   - 批量选择操作
   - 分类筛选
   - 分页浏览

3. **批量操作**
   - 全选/取消全选
   - 批量修改分类
   - 批量删除

4. **用户管理**
   - 账户创建/编辑
   - 权限管理
   - 登录状态

5. **安全设置**
   - IP/域名访问控制
   - 黑白名单管理

## 🐳 Docker 部署

### 使用 Docker

```bash
# 构建镜像
docker build -t random-image-api .

# 运行容器
docker run -p 3001:3001 -v $(pwd)/config:/app/config random-image-api
```

### 使用 Docker Compose

```yaml
version: '3.8'
services:
  random-image-api:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./config:/app/config
      - ./public/uploads:/app/public/uploads
    environment:
      - NODE_ENV=production
      - PORT=3001
```

## ⚙️ 配置选项

### 环境变量

```bash
# 服务配置
PORT=3001
NODE_ENV=production

# 数据库配置
DB_PATH=./config/images.db

# 安全配置
SESSION_SECRET=your-custom-secret-key
HTTPS=true                    # 启用HTTPS时设置为true

# CORS配置
CORS_ORIGIN=*

# 限流配置
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=1000
LOGIN_RATE_LIMIT=5
```

### 生产环境配置

#### 🛡️ **安全配置要求**

1. **必须设置的环境变量:**
```bash
export NODE_ENV=production
export SESSION_SECRET=your-super-secret-session-key-$(date +%s)
```

2. **HTTPS环境配置:**
```bash
export HTTPS=true             # 启用安全Cookie
export COOKIE_SECURE=true     # 强制安全Cookie
```

3. **生产环境启动:**
```bash
# 使用生产启动脚本 (自动配置安全参数)
./start-production.sh

# 手动启动生产环境
export NODE_ENV=production
export SESSION_SECRET=your-custom-secret
node src/app.js
```

#### 🔍 **生产环境检查清单**

启动后系统会自动显示安全检查清单：
- ✅ 更改默认管理员密码 (admin/admin123)
- ✅ 设置自定义SESSION_SECRET
- ✅ 配置HTTPS (如适用)
- ✅ 审核访问控制设置

### 反向代理配置

推荐使用 Nginx 或 1Panel 进行反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🧪 开发

### 项目结构

```
random-image-api/
├── src/
│   ├── app.js              # 主应用文件
│   ├── models/
│   │   └── Database.js     # 数据库模型
│   ├── routes/
│   │   ├── api.js          # API路由
│   │   └── auth.js         # 认证路由
│   ├── middleware/
│   │   └── auth.js         # 认证中间件
│   └── utils/
│       └── captcha.js      # 验证码工具
├── public/
│   ├── admin/
│   │   └── index.html      # 管理后台
│   ├── api-docs.html       # API文档
│   └── login.html          # 登录页面
├── config/                 # 数据库文件目录
├── start-server.sh         # 开发环境启动脚本
├── start-production.sh     # 生产环境启动脚本
├── .env.example            # 环境变量示例文件
├── package.json
├── Dockerfile
└── README.md
```

### 添加测试数据

项目提供了测试数据脚本：

```bash
node add-images.js
```

这将添加100张高质量测试图片到数据库。

### 环境差异说明

#### 开发环境 vs 生产环境

| 特性 | 开发环境 | 生产环境 |
|------|----------|----------|
| NODE_ENV | development | production |
| 会话密钥 | 默认值 | 动态生成 |
| Cookie安全 | 关闭 | 根据HTTPS自适应 |
| 安全提醒 | 基础 | 完整检查清单 |
| 启动脚本 | `./start-server.sh` | `./start-production.sh` |

#### 环境变量配置

**开发环境配置:**
```bash
# 复制环境变量模板
cp .env.example .env.development

# 编辑开发配置
NODE_ENV=development
SESSION_SECRET=dev-secret-key
```

**生产环境配置:**
```bash
# 复制环境变量模板  
cp .env.example .env.production

# 编辑生产配置
NODE_ENV=production
SESSION_SECRET=your-super-secure-production-key
HTTPS=true
```

### 健康检查

```bash
curl http://localhost:3001/health
```

## 🔧 故障排除

### 常见问题

1. **端口冲突**
   - 修改 `PORT` 环境变量
   - 检查其他服务占用

2. **图片上传失败**
   - 检查 `public/uploads` 目录权限
   - 确认文件大小限制

3. **数据库连接失败**
   - 检查 `config` 目录权限
   - 确认SQLite版本兼容性

4. **502 错误**
   - 检查反向代理配置
   - 确认服务运行状态

### 日志查看

```bash
# 查看服务日志
tail -f server.log

# 检查进程状态
ps aux | grep node
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 开发规范

- 使用 ESLint 进行代码检查
- 提交前运行测试
- 保持代码注释完整
- 遵循现有代码风格

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您觉得这个项目有用，请给它一个 ⭐️！

- **Issues**: [GitHub Issues](https://github.com/yourusername/random-image-api/issues)
- **讨论**: [GitHub Discussions](https://github.com/yourusername/random-image-api/discussions)

## 🙏 致谢

- [Express.js](https://expressjs.com/) - Web框架
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [SQLite](https://www.sqlite.org/) - 数据库
- [Unsplash](https://unsplash.com/) - 测试图片来源
- [Pixabay](https://pixabay.com/) - 测试图片来源

---

<div align="center">

**[⬆ 回到顶部](#-random-image-api)**

Made with ❤️ by [Your Name](https://github.com/yourusername)

</div>