const fs = require('fs').promises;
const path = require('path');

/**
 * 增强的文件安全验证工具
 */
class FileValidation {
  constructor() {
    // 允许的MIME类型
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];

    // 文件签名（魔术数字）验证
    this.fileSignatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46]
    };

    // 危险的文件扩展名
    this.dangerousExtensions = [
      '.php', '.php3', '.php4', '.php5', '.phtml',
      '.asp', '.aspx', '.jsp', '.py', '.pl',
      '.exe', '.bat', '.sh', '.cmd', '.scr',
      '.js', '.vbs', '.jar', '.war'
    ];

    // 最大文件大小 (10MB)
    this.maxFileSize = 10 * 1024 * 1024;
  }

  /**
   * 全面文件安全验证
   */
  async validateFile(file, filePath = null) {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 1. 基础验证
      this.validateBasics(file, validationResults);

      // 2. MIME类型验证
      this.validateMimeType(file, validationResults);

      // 3. 文件扩展名验证
      this.validateFileExtension(file, validationResults);

      // 4. 文件大小验证
      this.validateFileSize(file, validationResults);

      // 5. 如果有文件路径，进行深度验证
      if (filePath) {
        await this.validateFileContent(filePath, validationResults);
      }

      // 6. 文件名安全检查
      this.validateFileName(file, validationResults);

    } catch (error) {
      validationResults.isValid = false;
      validationResults.errors.push(`验证过程出错: ${error.message}`);
    }

    validationResults.isValid = validationResults.errors.length === 0;
    return validationResults;
  }

  /**
   * 基础验证
   */
  validateBasics(file, results) {
    if (!file) {
      results.errors.push('文件对象不能为空');
      return;
    }

    if (!file.originalname) {
      results.errors.push('文件名不能为空');
    }

    if (!file.mimetype) {
      results.errors.push('无法确定文件类型');
    }
  }

  /**
   * MIME类型验证
   */
  validateMimeType(file, results) {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      results.errors.push(`不支持的文件类型: ${file.mimetype}`);
    }
  }

  /**
   * 文件扩展名验证
   */
  validateFileExtension(file, results) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    // 检查是否为危险扩展名
    if (this.dangerousExtensions.includes(ext)) {
      results.errors.push(`危险的文件扩展名: ${ext}`);
      return;
    }

    // 检查是否为允许的图片扩展名
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowedExtensions.includes(ext)) {
      results.errors.push(`不支持的文件扩展名: ${ext}`);
    }
  }

  /**
   * 文件大小验证
   */
  validateFileSize(file, results) {
    if (file.size > this.maxFileSize) {
      results.errors.push(`文件大小超出限制: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${this.maxFileSize / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      results.errors.push('文件大小为0，可能已损坏');
    }
  }

  /**
   * 文件内容深度验证
   */
  async validateFileContent(filePath, results) {
    try {
      // 检查文件是否存在
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        results.errors.push('无效的文件路径');
        return;
      }

      // 读取文件头进行签名验证
      await this.validateFileSignature(filePath, results);

      // 检查是否包含可疑内容
      await this.scanForMaliciousContent(filePath, results);

    } catch (error) {
      results.errors.push(`文件内容验证失败: ${error.message}`);
    }
  }

  /**
   * 文件签名验证
   */
  async validateFileSignature(filePath, results) {
    try {
      const buffer = await fs.readFile(filePath, { start: 0, end: 20 });
      const fileBytes = Array.from(buffer);

      let signatureMatched = false;

      for (const [mimeType, signature] of Object.entries(this.fileSignatures)) {
        if (this.matchesSignature(fileBytes, signature)) {
          signatureMatched = true;
          break;
        }
      }

      if (!signatureMatched) {
        results.errors.push('文件签名验证失败，可能不是有效的图片文件');
      }

    } catch (error) {
      results.errors.push(`文件签名验证出错: ${error.message}`);
    }
  }

  /**
   * 检查文件签名是否匹配
   */
  matchesSignature(fileBytes, signature) {
    for (let i = 0; i < signature.length; i++) {
      if (fileBytes[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 扫描恶意内容
   */
  async scanForMaliciousContent(filePath, results) {
    try {
      // 读取文件内容（仅前1KB用于快速检测）
      const buffer = await fs.readFile(filePath, { start: 0, end: 1024 });
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));

      // 检查可疑脚本标签
      const maliciousPatterns = [
        /<script/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /javascript:/i,
        /vbscript:/i,
        /data:text\/html/i,
        /<\?php/i,
        /<%/,
        /eval\s*\(/i,
        /exec\s*\(/i
      ];

      for (const pattern of maliciousPatterns) {
        if (pattern.test(content)) {
          results.errors.push('检测到可疑的脚本内容，可能是恶意文件');
          break;
        }
      }

      // 检查是否包含过多的null字节（可能是二进制可执行文件）
      const nullBytes = (content.match(/\0/g) || []).length;
      if (nullBytes > content.length * 0.1) {
        results.warnings.push('文件包含大量null字节，请确认这是有效的图片文件');
      }

    } catch (error) {
      // 如果无法读取为文本，说明是二进制文件，这对图片是正常的
      // 只记录警告而不是错误
      results.warnings.push(`内容扫描: ${error.message}`);
    }
  }

  /**
   * 文件名安全检查
   */
  validateFileName(file, results) {
    const filename = file.originalname;

    // 检查文件名长度
    if (filename.length > 255) {
      results.errors.push('文件名过长');
    }

    // 检查危险字符
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      results.errors.push('文件名包含非法字符');
    }

    // 检查路径遍历攻击
    if (filename.includes('../') || filename.includes('..\\')) {
      results.errors.push('检测到路径遍历攻击尝试');
    }

    // 检查Windows保留名称
    const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    const nameWithoutExt = path.parse(filename).name;
    if (reservedNames.test(nameWithoutExt)) {
      results.errors.push('文件名使用了系统保留名称');
    }
  }

  /**
   * 生成安全的文件名
   */
  generateSafeFileName(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.parse(originalName).name;
    
    // 清理文件名：只保留字母、数字、连字符和下划线
    const safeName = baseName
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 50); // 限制长度

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${safeName}_${timestamp}_${random}${ext}`;
  }
}

module.exports = FileValidation;