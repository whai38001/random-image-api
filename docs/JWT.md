# JWT认证说明

本项目使用JWT (JSON Web Tokens) 和 Session 双重认证机制来确保API和管理后台的安全性。

## 🔐 认证机制

### JWT (JSON Web Tokens)
- 用于API访问认证
- 有效期为24小时
- 使用强随机密钥签名
- 包含用户ID信息

### Session认证
- 用于管理后台访问
- 包含完整的用户信息
- 支持会话过期和销毁

## 🗝️ 密钥管理

### 生成安全密钥
```bash
# 生成32字节随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 环境变量配置
```env
# JWT密钥（必须设置）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Session密钥（必须设置）
SESSION_SECRET=your-super-secret-session-key-change-me
```

## 🚀 使用方法

### 登录获取令牌
```bash
# 用户登录
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'

# 响应包含JWT令牌
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 使用JWT访问API
```bash
# 使用令牌访问受保护的API
curl -X GET http://localhost:3001/api/images \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 🔧 安全配置

### 生产环境配置
1. 使用强随机密钥
2. 启用HTTPS
3. 设置适当的CORS策略
4. 配置API限流

### 密钥轮换
```javascript
// 在代码中使用环境变量
const JWT_SECRET = process.env.JWT_SECRET || 'default-key';
```

## ⚠️ 安全最佳实践

### 密钥保护
- 不要在代码中硬编码密钥
- 使用环境变量存储密钥
- 定期轮换密钥
- 限制密钥访问权限

### 令牌安全
- 使用HTTPS传输令牌
- 设置适当的过期时间
- 在敏感操作后重新认证
- 实施令牌刷新机制

### 错误处理
```javascript
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  // 处理有效令牌
} catch (error) {
  if (error.name === 'TokenExpiredError') {
    // 处理过期令牌
  } else if (error.name === 'JsonWebTokenError') {
    // 处理无效令牌
  }
}
```

## 📊 监控和日志

### 令牌使用监控
- 记录令牌生成和验证
- 监控异常访问模式
- 审计令牌使用情况

### 安全日志
```javascript
// 记录认证事件
logger.security('jwt_token_generated', {
  userId: user.id,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});
```

## 🛠️ 故障排除

### 常见问题
1. **令牌无效**: 检查密钥是否正确配置
2. **令牌过期**: 实现自动刷新机制
3. **权限不足**: 验证用户角色和权限

### 调试技巧
```bash
# 检查环境变量
echo $JWT_SECRET

# 验证令牌
npm install -g jwt-cli
jwt decode your-token-here
```

## 📚 参考资料

- [JWT官网](https://jwt.io/)
- [JSON Web Tokens Best Practices](https://auth0.com/docs/tokens/json-web-tokens)
- [OAuth 2.0 and OpenID Connect](https://oauth.net/2/)