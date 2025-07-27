const { parentPort } = require('worker_threads');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

/**
 * 图片处理Worker
 */
class ImageWorker {
  constructor() {
    this.setupMessageHandler();
  }

  setupMessageHandler() {
    parentPort.on('message', async (message) => {
      try {
        const result = await this.processTask(message);
        parentPort.postMessage({
          success: true,
          data: result
        });
      } catch (error) {
        parentPort.postMessage({
          success: false,
          error: error.message
        });
      }
    });
  }

  async processTask(task) {
    const { type, inputPath, outputPath, options } = task;

    // 确保输出目录存在
    await fs.ensureDir(path.dirname(outputPath));

    switch (type) {
      case 'thumbnail':
        return await this.generateThumbnail(inputPath, outputPath, options);
      
      case 'optimize':
        return await this.optimizeImage(inputPath, outputPath, options);
      
      case 'convert':
        return await this.convertFormat(inputPath, outputPath, options);
      
      case 'resize':
        return await this.resizeImage(inputPath, outputPath, options);
      
      case 'metadata':
        return await this.extractMetadata(inputPath);
      
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(inputPath, outputPath, options) {
    const { width, height, quality = 80, format = 'jpeg' } = options;

    const pipeline = sharp(inputPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    if (format === 'jpeg') {
      pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline.png({ quality });
    } else if (format === 'webp') {
      pipeline.webp({ quality });
    }

    await pipeline.toFile(outputPath);

    const stats = await fs.stat(outputPath);
    return {
      outputPath,
      size: stats.size,
      format,
      dimensions: { width, height }
    };
  }

  /**
   * 优化图片
   */
  async optimizeImage(inputPath, outputPath, options) {
    const {
      quality = 80,
      format = 'jpeg',
      maxWidth = 1920,
      maxHeight = 1920,
      progressive = true
    } = options;

    // 获取原始图片信息
    const metadata = await sharp(inputPath).metadata();
    
    let pipeline = sharp(inputPath);

    // 如果图片太大，进行缩放
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 应用格式和质量设置
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ 
        quality, 
        progressive,
        mozjpeg: true 
      });
    } else if (format === 'png') {
      pipeline = pipeline.png({ 
        quality,
        progressive,
        compressionLevel: 9
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ 
        quality,
        effort: 6
      });
    }

    await pipeline.toFile(outputPath);

    const originalStats = await fs.stat(inputPath);
    const optimizedStats = await fs.stat(outputPath);
    const compressionRatio = (1 - optimizedStats.size / originalStats.size) * 100;

    return {
      outputPath,
      originalSize: originalStats.size,
      optimizedSize: optimizedStats.size,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      format
    };
  }

  /**
   * 转换图片格式
   */
  async convertFormat(inputPath, outputPath, options) {
    const { format, quality = 80 } = options;

    let pipeline = sharp(inputPath);

    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 6 });
        break;
      
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      
      case 'tiff':
        pipeline = pipeline.tiff({ quality });
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await pipeline.toFile(outputPath);

    const stats = await fs.stat(outputPath);
    return {
      outputPath,
      size: stats.size,
      format: format.toLowerCase()
    };
  }

  /**
   * 调整图片大小
   */
  async resizeImage(inputPath, outputPath, options) {
    const {
      width,
      height,
      fit = 'cover',
      position = 'center',
      background = { r: 255, g: 255, b: 255, alpha: 1 },
      quality = 80,
      format = 'jpeg'
    } = options;

    let pipeline = sharp(inputPath)
      .resize(width, height, {
        fit,
        position,
        background
      });

    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    }

    await pipeline.toFile(outputPath);

    const stats = await fs.stat(outputPath);
    return {
      outputPath,
      size: stats.size,
      dimensions: { width, height },
      format
    };
  }

  /**
   * 提取图片元数据
   */
  async extractMetadata(inputPath) {
    const metadata = await sharp(inputPath).metadata();
    const stats = await fs.stat(inputPath);

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      density: metadata.density,
      channels: metadata.channels,
      depth: metadata.depth,
      hasAlpha: metadata.hasAlpha,
      isProgressive: metadata.isProgressive,
      orientation: metadata.orientation,
      colorSpace: metadata.space,
      chromaSubsampling: metadata.chromaSubsampling,
      isAnimated: metadata.pages > 1,
      pageCount: metadata.pages || 1
    };
  }
}

// 启动Worker
new ImageWorker();