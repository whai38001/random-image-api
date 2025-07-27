const svgCaptcha = require('svg-captcha');

class CaptchaService {
  constructor() {
    this.captchaStore = new Map(); // 生产环境应使用Redis
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 每5分钟清理一次过期验证码
  }

  generateCaptcha() {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1il',
      noise: 2,
      color: true,
      background: '#f0f0f0',
      width: 120,
      height: 40
    });

    const id = this.generateId();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟过期

    this.captchaStore.set(id, {
      text: captcha.text.toLowerCase(),
      expiresAt: expiresAt,
      attempts: 0
    });

    return {
      id: id,
      svg: captcha.data,
      expiresAt: expiresAt
    };
  }

  verifyCaptcha(id, text) {
    const captchaData = this.captchaStore.get(id);
    
    if (!captchaData) {
      return {
        success: false,
        error: '验证码不存在或已过期'
      };
    }

    if (Date.now() > captchaData.expiresAt) {
      this.captchaStore.delete(id);
      return {
        success: false,
        error: '验证码已过期'
      };
    }

    captchaData.attempts++;

    if (captchaData.attempts > 3) {
      this.captchaStore.delete(id);
      return {
        success: false,
        error: '验证码尝试次数过多'
      };
    }

    if (text.toLowerCase() !== captchaData.text) {
      return {
        success: false,
        error: '验证码错误',
        attemptsLeft: 3 - captchaData.attempts
      };
    }

    // 验证成功，删除验证码
    this.captchaStore.delete(id);
    return {
      success: true
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [id, data] of this.captchaStore.entries()) {
      if (now > data.expiresAt) {
        this.captchaStore.delete(id);
      }
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.captchaStore.clear();
  }
}

module.exports = CaptchaService;