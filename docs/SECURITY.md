# 安全说明

本项目的安全特性和最佳实践。

## 🔒 安全特性

### 用户认证
- 使用JWT和Session双重认证机制
- bcryptjs加密用户密码
- SVG验证码防止自动化攻击
- 登录失败次数限制

### 访问控制
- 基于角色的访问控制（RBAC）
- IP黑白名单管理
- 域名访问限制
- API请求频率限制

### 数据安全
- SQLite数据库加密存储
- 敏感信息环境变量配置
- HTTPS支持
- 安全HTTP头部设置

### 会话安全
- 安全的Session密钥
- Session过期机制
- CSRF保护

## 🛡️ 安全配置

### 环境变量

生产环境必须设置的安全相关环境变量：

```env
# 会话密钥（必须修改）
SESSION_SECRET=your-super-secret-session-key-change-me

# JWT密钥（必须修改）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# HTTPS配置
HTTPS=true
COOKIE_SECURE=true

# CORS配置
CORS_ORIGIN=https://yourdomain.com

# 限流配置
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT=5
```

### 默认账户安全

首次启动会创建默认管理员账户：
- 用户名: `admin`
- 密码: `admin123`

⚠️ **重要**: 首次登录后请立即修改默认密码！

## 🔐 最佳实践

### 密码安全
1. 使用强密码（至少8位，包含大小写字母、数字和特殊字符）
2. 定期更换密码
3. 不要在代码中硬编码密码
4. 使用环境变量存储密钥

### 访问控制
1. 启用IP白名单限制
2. 配置域名访问控制
3. 定期审查用户权限
4. 及时禁用不需要的账户

### 网络安全
1. 使用HTTPS部署
2. 配置防火墙规则
3. 定期更新依赖包
4. 监控异常访问行为

### 数据保护
1. 定期备份数据库
2. 限制数据库文件访问权限
3. 使用参数化查询防止SQL注入
4. 验证和过滤所有用户输入

## 🚨 安全监控

### 日志记录
- 所有认证尝试
- 异常访问行为
- 系统安全事件
- API调用统计

### 告警机制
- 多次登录失败告警
- 异常IP访问告警
- 系统安全事件告警

## 📋 安全检查清单

部署前请检查以下安全配置：

- [ ] 修改默认管理员密码
- [ ] 设置自定义SESSION_SECRET
- [ ] 设置自定义JWT_SECRET
- [ ] 配置HTTPS证书
- [ ] 设置IP访问控制规则
- [ ] 配置域名白名单
- [ ] 调整API限流参数
- [ ] 审查用户权限设置
- [ ] 验证文件上传安全
- [ ] 检查数据库访问权限
- [ ] 配置日志轮转策略

## 🆘 应急响应

### IP封禁处理
如果发现恶意IP访问，系统会自动封禁。管理员可以通过以下方式处理：

1. 查看被封禁IP列表：
   ```bash
   # 在容器中执行
   node ip-management.js list
   ```

2. 解除IP封禁：
   ```bash
   # 解除特定IP
   node ip-management.js unblock 192.168.1.100
   
   # 清除所有封禁
   node ip-management.js clear
   ```

### 紧急情况处理
在紧急情况下（如大规模攻击），可以执行：

```bash
# 紧急停止所有外部访问
node emergency-stop.js
```

这将：
- 启用维护模式
- 拒绝所有非管理员访问
- 记录所有访问尝试
- 发送安全告警

## 🔍 安全审计

### 定期检查
建议定期执行以下安全检查：

1. 依赖包安全审计：
   ```bash
   npm audit
   ```

2. 文件权限检查：
   ```bash
   # 检查关键文件权限
   ls -la config/
   ls -la public/uploads/
   ```

3. 日志分析：
   ```bash
   # 查看安全相关日志
   grep -i "security\|warning\|error" logs/server.log
   ```

### 渗透测试
建议定期进行渗透测试，检查：
- 认证机制安全性
- 输入验证有效性
- 文件上传安全性
- API接口安全性
- 数据库访问安全性

## 📚 参考资料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)