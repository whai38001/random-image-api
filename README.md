# 🎨 Random Image API

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)

一个功能完整的随机图片API服务，支持图片分类、方向筛选、后台管理、用户认证和系统设置。

## ✨ 特性

### 🚀 核心功能
- **随机图片API**: 支持分类和方向筛选的高性能图片服务
- **多格式支持**: 直接图片访问和JSON格式数据
- **图片管理**: 支持本地上传和URL链接两种方式
- **智能分类**: 6大分类（风景、动漫、美女、自然、城市、艺术）
- **方向支持**: 横屏/竖屏自动识别和筛选

### 🎯 管理功能
- **缩略图系统**: 自动生成多尺寸缩略图，支持懒加载
- **批量操作**: 支持批量分类修改和删除
- **分页管理**: 高效分页加载，支持大量图片
- **数据统计**: 实时统计各分类图片数量
- **用户管理**: 完整的用户注册、审批和权限管理
- **系统设置**: 注册控制、维护模式、用户限制等

### 🔒 安全特性
- **用户认证**: JWT + Session双重认证
- **验证码保护**: SVG验证码防止自动化攻击
- **访问控制**: IP/域名黑白名单管理
- **频率限制**: 多级API请求频率限制
- **安全头部**: Helmet安全中间件
- **维护模式**: 支持系统维护时的访问控制

### ⚡ 性能优化
- **数据库索引**: 12个关键索引优化查询性能
- **缩略图优化**: 智能缩略图生成和缓存策略
- **懒加载机制**: Intersection Observer实现图片懒加载
- **统计API优化**: 专门的统计端点避免大数据加载
- **CORS支持**: 默认支持跨域访问
- **健康检查**: 内置健康检查端点

### 📊 分析统计
- **使用分析**: 详细的API调用统计和用户行为分析
- **安全监控**: 可疑活动检测和记录
- **性能监控**: 响应时间和错误率统计
- **自动维护**: 定时清理和优化任务

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite3 + 优化索引
- **认证**: JWT + bcryptjs
- **图片处理**: Sharp (缩略图生成)
- **文件上传**: Multer + 进度监控
- **安全**: Helmet + CORS + Rate Limiting
- **前端**: 原生JavaScript + 响应式CSS
- **邮件服务**: Nodemailer (密码重置)

## 📦 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/whai38001/random-image-api.git
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
- 注册页面: http://localhost:3001/register

### 默认账户
- 用户名: `admin`
- 密码: `admin123`

⚠️ **生产环境请立即修改默认密码！**

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

#### 获取统计信息
```http
GET /api/stats
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

### 缩略图接口

#### 获取缩略图
```http
GET /thumbnails/{size}/{filename}
```

**尺寸选项:**
- `small`: 150x150
- `medium`: 300x300  
- `large`: 500x500

#### 缩略图管理
```http
POST /thumbnails/generate-missing  # 生成缺失缩略图
GET /thumbnails/stats              # 获取缩略图统计
POST /thumbnails/cleanup-orphaned  # 清理孤立缩略图
```

### 系统设置接口

#### 获取注册状态
```http
GET /system/public/registration-status
```

#### 系统配置管理 (需要管理员权限)
```http
GET /system                 # 获取系统配置
POST /system               # 更新配置
PUT /system/batch          # 批量更新配置
```

## 🎨 管理后台

### 功能特色

1. **仪表盘统计**
   - 总图片数量
   - 分类分布
   - 方向统计
   - 缩略图覆盖率

2. **图片管理**
   - 智能缩略图预览
   - 批量选择操作
   - 分类筛选
   - 高性能分页浏览
   - 拖拽上传支持

3. **批量操作**
   - 全选/取消全选
   - 批量修改分类
   - 批量删除
   - 缩略图批量生成

4. **用户管理**
   - 用户注册审批
   - 账户创建/编辑
   - 权限管理
   - 登录状态监控

5. **安全设置**
   - IP/域名访问控制
   - 黑白名单管理
   - 密码修改
   - 登录记录

6. **系统设置**
   - 注册开关控制
   - 用户数量限制
   - 维护模式开关
   - 用户审批开关
   - 自定义注册消息

### 新增管理功能

- **实时进度显示**: 文件上传进度条
- **懒加载优化**: 图片按需加载，提升性能
- **智能错误处理**: 多级回退机制
- **缓存优化**: 统计信息智能缓存
- **维护工具**: 一键缩略图生成和修复

## 🔧 系统设置

### 注册控制
- **开启/关闭注册**: 完全控制新用户注册
- **用户审批**: 新注册用户需要管理员审批
- **数量限制**: 设置系统最大用户数量
- **自定义消息**: 注册页面欢迎消息

### 维护模式
- **系统维护**: 开启后普通用户无法访问
- **管理员豁免**: 管理员在维护模式下仍可正常使用
- **友好提示**: 维护模式显示友好的提示页面

### 安全设置
- **访问控制**: IP和域名级别的访问控制
- **频率限制**: 多层级的请求频率限制
- **安全监控**: 自动检测和记录可疑活动

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
      - SESSION_SECRET=your-super-secret-key
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

# 邮件配置 (可选)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
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
- ✅ 更改默认管理员密码
- ✅ 设置自定义SESSION_SECRET
- ✅ 配置HTTPS (如适用)
- ✅ 审核访问控制设置
- ✅ 配置邮件服务 (SMTP设置)

### 反向代理配置

推荐使用 Nginx 或 1Panel 进行反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 提高上传限制
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持 (如需要)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🧪 开发

### 项目结构

```
random-image-api/
├── src/
│   ├── app.js                 # 主应用文件
│   ├── models/
│   │   └── Database.js        # 数据库模型
│   ├── routes/
│   │   ├── api.js             # API路由
│   │   ├── auth.js            # 认证路由
│   │   ├── system.js          # 系统设置路由
│   │   ├── thumbnails.js      # 缩略图路由
│   │   └── analytics.js       # 分析统计路由
│   ├── middleware/
│   │   ├── auth.js            # 认证中间件
│   │   ├── analytics.js       # 分析中间件
│   │   └── security.js        # 安全中间件
│   ├── services/
│   │   └── ThumbnailService.js # 缩略图服务
│   └── utils/
│       ├── captcha.js         # 验证码工具
│       └── emailService.js    # 邮件服务
├── public/
│   ├── admin/
│   │   └── index.html         # 管理后台
│   ├── api-docs.html          # API文档
│   ├── login.html             # 登录页面
│   ├── register.html          # 注册页面
│   ├── forgot-password.html   # 忘记密码页面
│   └── reset-password.html    # 重置密码页面
├── config/                    # 数据库文件目录
├── start-server.sh            # 开发环境启动脚本
├── start-production.sh        # 生产环境启动脚本
├── .env.example               # 环境变量示例文件
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

### 性能优化特性

#### 图片加载优化
- **懒加载**: Intersection Observer实现按需加载
- **缩略图预加载**: 智能预加载策略
- **多级回退**: 缩略图→原图→占位符
- **进度显示**: 上传进度实时反馈

#### 数据库优化
- **统计优化**: 专门的统计API避免全表扫描
- **索引优化**: 12个关键索引提升查询性能
- **连接池**: 数据库连接复用
- **定时维护**: 自动清理和优化任务

#### 前端优化
- **DocumentFragment**: 批量DOM操作
- **防抖节流**: 避免频繁请求
- **虚拟滚动**: 大量数据高效渲染
- **智能缓存**: 统计信息和图片缓存

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
   - 确认文件大小限制 (默认10MB)
   - 检查磁盘空间

3. **数据库连接失败**
   - 检查 `config` 目录权限
   - 确认SQLite版本兼容性
   - 检查数据库文件权限

4. **502 错误**
   - 检查反向代理配置
   - 确认服务运行状态
   - 检查防火墙设置

5. **缩略图生成失败**
   - 检查Sharp依赖安装
   - 确认图片格式支持
   - 检查临时目录权限

### 日志查看

```bash
# 查看服务日志
tail -f server.log

# 检查进程状态
ps aux | grep node

# 检查端口占用
lsof -i :3001
```

### 维护命令

```bash
# 生成缺失缩略图
curl -X POST http://localhost:3001/thumbnails/generate-missing

# 清理孤立缩略图
curl -X POST http://localhost:3001/thumbnails/cleanup-orphaned

# 获取系统统计
curl http://localhost:3001/api/stats
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

- **Issues**: [GitHub Issues](https://github.com/whai38001/random-image-api/issues)
- **讨论**: [GitHub Discussions](https://github.com/whai38001/random-image-api/discussions)

## 🙏 致谢

- [Express.js](https://expressjs.com/) - Web框架
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理
- [SQLite](https://www.sqlite.org/) - 数据库
- [Unsplash](https://unsplash.com/) - 测试图片来源
- [Pixabay](https://pixabay.com/) - 测试图片来源

---

<div align="center">

**[⬆ 回到顶部](#-random-image-api)**

Made with ❤️ by [whai38001](https://github.com/whai38001)

</div>