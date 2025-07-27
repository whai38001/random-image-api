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
- **实时搜索**: 支持关键词、分类、方向多维搜索
- **搜索建议**: 智能关键词提示和热门推荐
- **邮件服务**: 注册确认和密码重置邮件

### 🔒 安全特性
- **双重认证**: JWT + Session双重认证机制
- **验证码保护**: SVG验证码防止自动化攻击
- **访问控制**: IP/域名黑白名单管理
- **频率限制**: 多级API请求频率限制
- **安全头部**: Helmet安全中间件
- **维护模式**: 支持系统维护时的访问控制
- **异常检测**: 智能可疑活动检测和自动封禁
- **文件安全**: 完整的文件上传安全验证
- **路径保护**: 防路径遍历攻击
- **SQL注入防护**: 参数化查询和输入验证

### ⚡ 性能优化
- **数据库索引**: 12个关键索引优化查询性能
- **缩略图优化**: 智能缩略图生成和缓存策略
- **Worker线程池**: 高性能并行图片处理
- **懒加载机制**: Intersection Observer实现图片懒加载
- **统计API优化**: 专门的统计端点避免大数据加载
- **CORS支持**: 默认支持跨域访问
- **健康检查**: 内置健康检查端点
- **性能监控**: 实时响应时间和内存监控

### 📊 分析统计
- **使用分析**: 详细的API调用统计和用户行为分析
- **安全监控**: 可疑活动检测和记录
- **性能监控**: 响应时间和错误率统计
- **自动维护**: 定时清理和优化任务

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite (轻量级，易于部署)
- **图片处理**: Sharp (高性能图片处理库)
- **认证**: Express-session + Bcryptjs
- **安全**: Helmet, CORS, Rate-limiting
- **日志**: Winston (结构化日志记录)
- **测试**: Jest (单元测试框架)

## 📦 安装部署

### Docker部署 (推荐)

```bash
# 克隆项目
git clone https://github.com/whai38001/random-image-api.git
cd random-image-api

# 复制环境配置
cp .env.docker .env
# 编辑 .env 文件，设置您的配置

# 启动服务
docker-compose up -d

# 访问应用
# 前台: http://localhost:3001
# 后台: http://localhost:3001/admin
```

### 本地部署

```bash
# 克隆项目
git clone https://github.com/whai38001/random-image-api.git
cd random-image-api

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env
# 编辑 .env 文件，设置您的配置

# 启动服务
npm start

# 或者开发模式启动
npm run dev
```

## 🔧 环境配置

创建 `.env` 文件并配置以下参数：

```env
# 应用配置
NODE_ENV=production
PORT=3001

# 安全配置
SESSION_SECRET=your-super-secret-session-key
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 数据库配置
DB_PATH=./config/images.db

# HTTPS配置
HTTPS=false
COOKIE_SECURE=false

# CORS配置
CORS_ORIGIN=*

# 限流配置
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=1000
LOGIN_RATE_LIMIT=5

# 日志配置
LOG_LEVEL=info
```

## 🚀 API接口

### 获取随机图片

```bash
# 获取随机图片
GET /api/random

# 指定分类
GET /api/random?category=landscape

# 指定方向
GET /api/random?orientation=portrait

# 指定分类和方向
GET /api/random?category=anime&orientation=landscape
```

### 图片管理API

```bash
# 获取所有图片 (分页)
GET /api/images?page=1&limit=12

# 获取特定图片
GET /api/images/:id

# 上传图片
POST /api/images

# 更新图片
PUT /api/images/:id

# 删除图片
DELETE /api/images/:id
```

### 搜索API

```bash
# 综合搜索
GET /api/search?query=keyword&category=nature&orientation=landscape&type=local&sort=newest&page=1&limit=12

# 搜索建议
GET /api/search/suggestions?q=keyword&limit=5

# 热门关键词
GET /api/search/popular?limit=10

# 获取所有分类
GET /api/search/categories

# 快速过滤
GET /api/search/filter?type=local&orientation=landscape
```

### 统计API

```bash
# 获取图片统计信息
GET /api/stats

# 获取API使用统计
GET /api/analytics
```

## 👨‍💼 后台管理

访问 `/admin` 进入后台管理系统，默认管理员账户：
- 用户名: `admin`
- 密码: `admin123`

> ⚠️ **重要**: 首次登录后请立即修改默认密码！

### 管理功能包括：
- 图片上传和管理
- 用户账户管理
- 系统配置设置
- 安全访问控制
- 统计数据分析

## 🔐 安全说明

1. **默认账户**: 首次启动会创建默认管理员账户，请立即修改密码
2. **会话安全**: 使用安全的Session密钥，建议在生产环境中更改
3. **JWT认证**: 使用强随机密钥的JWT令牌认证
4. **访问控制**: 支持IP黑白名单和域名限制
5. **频率限制**: 防止API滥用和暴力破解攻击
6. **HTTPS支持**: 支持HTTPS部署，提高传输安全性

详细安全配置请查看 [安全文档](docs/SECURITY.md) 和 [JWT认证说明](docs/JWT.md)。

## 📁 项目结构

```
random-image-api/
├── config/           # 数据库配置文件
├── public/           # 静态资源文件
│   ├── uploads/      # 上传的图片文件
│   └── admin/        # 后台管理界面
├── src/              # 源代码目录
│   ├── routes/       # 路由处理
│   ├── models/       # 数据模型
│   ├── middleware/   # 中间件
│   └── utils/        # 工具函数
├── docs/             # 详细文档
├── logs/             # 日志文件
├── .env              # 环境配置文件
├── Dockerfile        # Docker配置
└── docker-compose.yml # Docker编排配置
```

## 🐳 Docker支持

项目提供完整的Docker支持，包含：
- 应用容器
- Nginx反向代理 (可选)
- 监控服务 (可选)

```bash
# 基础服务
docker-compose up -d

# 包含Nginx代理
docker-compose --profile nginx up -d

# 包含监控服务
docker-compose --profile monitoring up -d

# 全部服务
docker-compose --profile nginx --profile monitoring up -d
```

## 📊 监控和日志

### 日志级别
- `error`: 错误信息
- `warn`: 警告信息
- `info`: 一般信息
- `debug`: 调试信息

### 监控端点
- `/health`: 健康检查
- `/metrics`: 性能指标 (如果启用监控)

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