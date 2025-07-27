const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    // 根据环境变量配置邮件服务
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // 如果未配置邮件服务，使用测试模式
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('📧 Email service not configured, using test mode');
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });
    } else {
      this.transporter = nodemailer.createTransport(emailConfig);
      console.log('📧 Email service configured with custom SMTP settings');
    }
  }

  async sendPasswordResetEmail(email, resetUrl, username) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Random Image API" <noreply@randomimageapi.com>',
        to: email,
        subject: '密码重置请求 - Random Image API',
        html: this.generatePasswordResetTemplate(username, resetUrl)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 Password reset email sent:', nodemailer.getTestMessageUrl(info));
      }
      
      return {
        success: true,
        messageId: info.messageId,
        testUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generatePasswordResetTemplate(username, resetUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>密码重置</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #6b7280; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔐 密码重置请求</h1>
      </div>
      
      <div class="content">
        <p>您好 <strong>${username}</strong>，</p>
        
        <p>我们收到了您的密码重置请求。如果这是您本人操作，请点击下面的按钮重置您的密码：</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">重置密码</a>
        </div>
        
        <p>或者您也可以复制以下链接到浏览器中打开：</p>
        <p style="background: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 14px;">
          ${resetUrl}
        </p>
        
        <div class="warning">
          <p><strong>⚠️ 安全提醒：</strong></p>
          <ul>
            <li>此链接将在 <strong>1小时</strong> 后失效</li>
            <li>如果您没有请求密码重置，请忽略此邮件</li>
            <li>请勿将此链接分享给任何人</li>
            <li>建议使用强密码并定期更新</li>
          </ul>
        </div>
        
        <p>如果您有任何疑问，请联系系统管理员。</p>
        
        <p>谢谢！<br>Random Image API 团队</p>
      </div>
      
      <div class="footer">
        <p>此邮件由系统自动发送，请勿直接回复。</p>
        <p>© ${new Date().getFullYear()} Random Image API. All rights reserved.</p>
      </div>
    </body>
    </html>
    `;
  }

  async sendWelcomeEmail(email, username, tempPassword = null) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Random Image API" <noreply@randomimageapi.com>',
        to: email,
        subject: '欢迎使用 Random Image API',
        html: this.generateWelcomeTemplate(username, tempPassword)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📧 Welcome email sent:', nodemailer.getTestMessageUrl(info));
      }
      
      return {
        success: true,
        messageId: info.messageId,
        testUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('Welcome email send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateWelcomeTemplate(username, tempPassword = null) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>欢迎使用 Random Image API</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #6b7280; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
        .info-box { background: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 欢迎加入！</h1>
      </div>
      
      <div class="content">
        <p>您好 <strong>${username}</strong>，</p>
        
        <p>欢迎使用 Random Image API！您的账户已成功创建。</p>
        
        ${tempPassword ? `
        <div class="info-box">
          <p><strong>🔑 您的临时登录信息：</strong></p>
          <p>用户名：<code>${username}</code></p>
          <p>临时密码：<code>${tempPassword}</code></p>
          <p><strong>请立即登录并修改密码！</strong></p>
        </div>
        ` : ''}
        
        <div style="text-align: center;">
          <a href="${process.env.APP_URL || 'http://localhost:3001'}/login" class="button">立即登录</a>
        </div>
        
        <h3>📋 您可以使用以下功能：</h3>
        <ul>
          <li>🖼️ 随机图片API接口</li>
          <li>📊 管理后台</li>
          <li>🎯 图片分类和筛选</li>
          <li>📈 使用统计分析</li>
          <li>🔧 系统设置管理</li>
        </ul>
        
        <p>如果您有任何疑问，请联系系统管理员。</p>
        
        <p>祝您使用愉快！<br>Random Image API 团队</p>
      </div>
      
      <div class="footer">
        <p>此邮件由系统自动发送，请勿直接回复。</p>
        <p>© ${new Date().getFullYear()} Random Image API. All rights reserved.</p>
      </div>
    </body>
    </html>
    `;
  }

  // 测试邮件配置
  async testConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: '邮件服务连接正常' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;