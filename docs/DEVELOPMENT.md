# 开发指南

本文档介绍了如何设置开发环境、项目结构和开发流程。

## 🛠️ 开发环境设置

### 本地开发

```bash
# 克隆项目
git clone https://github.com/your-username/random-image-api.git
cd random-image-api

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env
# 编辑 .env 文件，设置您的配置

# 启动开发服务器
npm run dev
```

### Docker开发

```bash
# 使用Docker进行开发
docker-compose -f docker-compose.dev.yml up --build
```

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
├── docs/             # 文档
├── logs/             # 日志文件
├── tests/            # 测试文件
├── .env              # 环境配置文件
├── Dockerfile        # Docker配置
└── docker-compose.yml # Docker编排配置
```

## 🧪 测试

### 单元测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- tests/routes/api.test.js
```

### API测试

使用Postman或curl测试API端点：

```bash
# 获取随机图片
curl http://localhost:3001/api/random

# 获取特定分类的图片
curl http://localhost:3001/api/random?category=landscape
```

## 📦 依赖管理

### 添加新依赖

```bash
# 添加生产依赖
npm install package-name --save

# 添加开发依赖
npm install package-name --save-dev
```

### 更新依赖

```bash
# 检查过时的依赖
npm outdated

# 更新所有依赖
npm update
```

## 🐳 Docker开发工作流

1. 修改代码
2. Docker容器会自动重启并应用更改
3. 在`logs/`目录中查看日志
4. 使用`docker-compose logs`查看容器日志

## 🛡️ 安全开发实践

1. 不要在代码中硬编码敏感信息
2. 使用环境变量存储密钥和密码
3. 定期更新依赖包
4. 验证所有用户输入
5. 使用HTTPS进行生产部署

## 📝 代码规范

- 使用ESLint进行代码检查
- 遵循JavaScript Standard Style
- 添加适当的注释和文档
- 编写单元测试覆盖关键功能

## 🚀 部署

### 生产环境部署

```bash
# 构建并启动生产环境
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 环境变量配置

确保在生产环境中设置以下关键变量：
- `SESSION_SECRET` - 安全的会话密钥
- `NODE_ENV` - 设置为production
- `DB_PATH` - 数据库文件路径