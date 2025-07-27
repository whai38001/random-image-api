# HTTPS反向代理配置指南

## 当前配置状态
✅ 服务器已配置支持HTTPS反向代理环境  
✅ 安全cookies和HSTS已启用  
✅ CORS已配置支持 `https://rp.itdianbao.com`  
✅ CSP安全策略已优化  

## 服务器配置
- **后端端口**: 3001
- **环境模式**: production  
- **Session安全**: 启用secure cookies
- **信任代理**: 已启用 (trust proxy: 1)

## 反向代理建议配置

### Nginx配置示例
```nginx
server {
    listen 443 ssl http2;
    server_name rp.itdianbao.com;
    
    # SSL配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    
    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name rp.itdianbao.com;
    return 301 https://$server_name$request_uri;
}
```

### Apache配置示例
```apache
<VirtualHost *:443>
    ServerName rp.itdianbao.com
    
    # SSL配置
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    # 代理配置
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
    
    # 头部设置
    ProxyPassReverse / http://127.0.0.1:3001/
    ProxyPassReverseAdjustHeaders On
    
    # 安全头
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
    
    # 转发真实IP
    RemoteIPHeader X-Forwarded-For
    RemoteIPInternalProxy 127.0.0.1
</VirtualHost>
```

## 安全检查清单
- [x] SSL证书配置
- [x] HSTS启用 (已在应用中配置)
- [x] 安全cookies (secure, httpOnly, sameSite)
- [x] CSP策略配置
- [x] 代理IP信任配置
- [x] CORS域名白名单
- [x] 请求大小限制 (10MB)
- [x] 全局速率限制 (1000/15min)

## 访问测试
现在你可以通过以下方式访问：

**HTTPS域名（推荐）:**
- 主页: https://rp.itdianbao.com
- 管理: https://rp.itdianbao.com/admin
- 登录: https://rp.itdianbao.com/login
- 注册: https://rp.itdianbao.com/register

**本地测试:**
- http://localhost:3001 (仍然可用)

## 故障排除
1. **Session问题**: 确保代理传递了 `X-Forwarded-Proto: https`
2. **CORS错误**: 检查Origin头是否为 `https://rp.itdianbao.com`
3. **静态文件**: 确保代理转发所有请求到后端
4. **Cookie问题**: 检查secure flag和sameSite设置

## 监控建议
- 监控SSL证书过期时间
- 检查代理服务器日志
- 监控后端服务器性能
- 定期检查安全头配置