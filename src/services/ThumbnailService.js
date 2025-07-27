const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');
const Database = require('../models/Database');
const ImageWorkerPool = require('../utils/imageWorkerPool');
const logger = require('../utils/logger');

class ThumbnailService {
  constructor() {
    this.db = new Database();
    this.thumbnailDir = path.join(__dirname, '../../public/uploads/thumbnails');
    this.originalDir = path.join(__dirname, '../../public/uploads');
    this.processingQueue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.thumbnailSizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 500, height: 500 }
    };
    
    // 🚀 初始化Worker线程池
    this.workerPool = new ImageWorkerPool(2); // 2个Worker线程
    
    // 确保缩略图目录存在
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.ensureDir(this.thumbnailDir);
      // 为不同尺寸创建子目录
      for (const size of Object.keys(this.thumbnailSizes)) {
        await fs.ensureDir(path.join(this.thumbnailDir, size));
      }
      console.log('📁 Thumbnail directories ensured');
    } catch (error) {
      console.error('Error ensuring thumbnail directories:', error);
    }
  }

  // 🚀 生成单个缩略图 - 使用Worker线程池
  async generateThumbnail(imagePath, outputPath, size = 'medium', quality = 80) {
    try {
      // 检查原图是否存在
      if (!(await fs.pathExists(imagePath))) {
        throw new Error(`Original image not found: ${imagePath}`);
      }

      // 使用Worker线程池生成缩略图
      const result = await this.workerPool.generateThumbnail(imagePath, outputPath, size);
      
      logger.performance('Thumbnail generated', {
        imagePath,
        outputPath,
        size,
        outputSize: result.size
      });

      return {
        success: true,
        originalSize: result.dimensions,
        thumbnailSize: result.dimensions,
        outputPath: result.outputPath,
        fileSize: result.size
      };
    } catch (error) {
      logger.error(`Error generating thumbnail for ${imagePath}`, { 
        error: error.message,
        imagePath,
        outputPath,
        size 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 生成多种尺寸的缩略图
  async generateMultipleThumbnails(imagePath, baseFilename) {
    const results = {};
    
    for (const [sizeName, dimensions] of Object.entries(this.thumbnailSizes)) {
      const outputFilename = `${sizeName}_${baseFilename}`;
      const outputPath = path.join(this.thumbnailDir, sizeName, outputFilename);
      
      results[sizeName] = await this.generateThumbnail(imagePath, outputPath, sizeName);
      results[sizeName].filename = outputFilename;
    }
    
    return results;
  }

  // 批量生成缺失的缩略图
  async generateMissingThumbnails() {
    try {
      console.log('🔄 Starting batch thumbnail generation...');
      
      // 获取所有本地图片
      const images = await this.db.getAllImages();
      const localImages = images.filter(img => img.is_local === 1);
      
      console.log(`📊 Found ${localImages.length} local images to check`);
      
      let generated = 0;
      let failed = 0;
      let skipped = 0;
      
      for (const image of localImages) {
        if (!image.filename) {
          skipped++;
          continue;
        }
        
        const originalPath = path.join(this.originalDir, image.filename);
        
        // 检查原图是否存在
        if (!(await fs.pathExists(originalPath))) {
          console.warn(`⚠️ Original image not found: ${image.filename}`);
          failed++;
          continue;
        }
        
        // 检查是否已有缩略图
        const hasAllThumbnails = await this.checkAllThumbnailsExist(image.filename);
        
        if (hasAllThumbnails) {
          skipped++;
          continue;
        }
        
        // 生成缩略图
        console.log(`🖼️ Generating thumbnails for: ${image.filename}`);
        const results = await this.generateMultipleThumbnails(originalPath, image.filename);
        
        // 检查生成结果
        const allSuccessful = Object.values(results).every(result => result.success);
        
        if (allSuccessful) {
          generated++;
          
          // 更新数据库中的缩略图信息
          await this.updateImageThumbnail(image.id, results.medium.filename);
          
          console.log(`✅ Generated thumbnails for: ${image.filename}`);
        } else {
          failed++;
          console.error(`❌ Failed to generate thumbnails for: ${image.filename}`);
        }
        
        // 添加小延迟避免过度占用CPU
        await this.sleep(100);
      }
      
      const summary = {
        total: localImages.length,
        generated,
        failed,
        skipped,
        timestamp: new Date().toISOString()
      };
      
      console.log('📋 Batch thumbnail generation completed:', summary);
      return summary;
      
    } catch (error) {
      console.error('Error in batch thumbnail generation:', error);
      throw error;
    }
  }

  // 检查所有尺寸的缩略图是否存在
  async checkAllThumbnailsExist(filename) {
    for (const sizeName of Object.keys(this.thumbnailSizes)) {
      const thumbnailPath = path.join(this.thumbnailDir, sizeName, `${sizeName}_${filename}`);
      if (!(await fs.pathExists(thumbnailPath))) {
        return false;
      }
    }
    return true;
  }

  // 更新数据库中的缩略图信息
  async updateImageThumbnail(imageId, thumbnailFilename) {
    try {
      // 这里我们使用medium尺寸作为默认缩略图
      await this.db.db.run(
        'UPDATE images SET thumbnail = ? WHERE id = ?',
        [`medium_${thumbnailFilename}`, imageId]
      );
    } catch (error) {
      console.error('Error updating thumbnail in database:', error);
    }
  }

  // 获取缩略图路径
  getThumbnailPath(filename, size = 'medium') {
    if (!filename) return null;
    
    // 如果filename已经包含尺寸前缀，直接使用
    if (filename.startsWith('small_') || filename.startsWith('medium_') || filename.startsWith('large_')) {
      const [sizePrefix, ...rest] = filename.split('_');
      return path.join(this.thumbnailDir, sizePrefix, filename);
    }
    
    // 否则添加尺寸前缀
    const thumbnailFilename = `${size}_${filename}`;
    return path.join(this.thumbnailDir, size, thumbnailFilename);
  }

  // 清理孤立的缩略图（原图已删除但缩略图还在）
  async cleanupOrphanedThumbnails() {
    try {
      console.log('🧹 Starting orphaned thumbnail cleanup...');
      
      const images = await this.db.getAllImages();
      const localImageFilenames = new Set(
        images
          .filter(img => img.is_local === 1 && img.filename)
          .map(img => img.filename)
      );
      
      let cleaned = 0;
      
      for (const sizeName of Object.keys(this.thumbnailSizes)) {
        const sizeDir = path.join(this.thumbnailDir, sizeName);
        
        if (await fs.pathExists(sizeDir)) {
          const thumbnailFiles = await fs.readdir(sizeDir);
          
          for (const thumbnailFile of thumbnailFiles) {
            // 提取原文件名（去掉尺寸前缀）
            const originalFilename = thumbnailFile.replace(`${sizeName}_`, '');
            
            if (!localImageFilenames.has(originalFilename)) {
              const thumbnailPath = path.join(sizeDir, thumbnailFile);
              await fs.remove(thumbnailPath);
              cleaned++;
              console.log(`🗑️ Removed orphaned thumbnail: ${thumbnailFile}`);
            }
          }
        }
      }
      
      console.log(`✅ Cleaned up ${cleaned} orphaned thumbnails`);
      return { cleaned };
      
    } catch (error) {
      console.error('Error cleaning up orphaned thumbnails:', error);
      throw error;
    }
  }

  // 获取缩略图生成统计
  async getThumbnailStats() {
    try {
      const images = await this.db.getAllImages();
      const localImages = images.filter(img => img.is_local === 1);
      
      let withThumbnails = 0;
      let withoutThumbnails = 0;
      let totalSizes = {
        small: 0,
        medium: 0,
        large: 0
      };
      
      for (const image of localImages) {
        if (!image.filename) {
          withoutThumbnails++;
          continue;
        }
        
        const hasAllThumbnails = await this.checkAllThumbnailsExist(image.filename);
        
        if (hasAllThumbnails) {
          withThumbnails++;
          
          // 统计各尺寸文件大小
          for (const sizeName of Object.keys(this.thumbnailSizes)) {
            const thumbnailPath = path.join(this.thumbnailDir, sizeName, `${sizeName}_${image.filename}`);
            try {
              const stats = await fs.stat(thumbnailPath);
              totalSizes[sizeName] += stats.size;
            } catch (error) {
              // 忽略文件不存在的错误
            }
          }
        } else {
          withoutThumbnails++;
        }
      }
      
      return {
        total: localImages.length,
        withThumbnails,
        withoutThumbnails,
        coverage: localImages.length > 0 ? (withThumbnails / localImages.length * 100).toFixed(2) : 0,
        totalSizes,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error getting thumbnail stats:', error);
      throw error;
    }
  }

  // 异步处理队列
  async addToQueue(imagePath, filename, priority = 'normal') {
    this.processingQueue.push({
      imagePath,
      filename,
      priority,
      retries: 0,
      addedAt: Date.now()
    });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    console.log(`🔄 Processing thumbnail queue (${this.processingQueue.length} items)`);
    
    while (this.processingQueue.length > 0) {
      // 按优先级排序
      this.processingQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      const item = this.processingQueue.shift();
      
      try {
        const results = await this.generateMultipleThumbnails(item.imagePath, item.filename);
        const allSuccessful = Object.values(results).every(result => result.success);
        
        if (allSuccessful) {
          console.log(`✅ Queue: Generated thumbnails for ${item.filename}`);
        } else {
          throw new Error('Some thumbnails failed to generate');
        }
        
      } catch (error) {
        item.retries++;
        
        if (item.retries < this.maxRetries) {
          console.warn(`⚠️ Queue: Retrying ${item.filename} (attempt ${item.retries + 1})`);
          this.processingQueue.push(item);
        } else {
          console.error(`❌ Queue: Failed to generate thumbnails for ${item.filename} after ${this.maxRetries} attempts`);
        }
      }
      
      // 添加小延迟
      await this.sleep(50);
    }
    
    this.isProcessing = false;
    console.log('✅ Thumbnail queue processing completed');
  }

  // 修复损坏的缩略图
  async repairCorruptedThumbnails() {
    try {
      console.log('🔧 Starting corrupted thumbnail repair...');
      
      let repaired = 0;
      
      for (const sizeName of Object.keys(this.thumbnailSizes)) {
        const sizeDir = path.join(this.thumbnailDir, sizeName);
        
        if (await fs.pathExists(sizeDir)) {
          const thumbnailFiles = await fs.readdir(sizeDir);
          
          for (const thumbnailFile of thumbnailFiles) {
            const thumbnailPath = path.join(sizeDir, thumbnailFile);
            
            try {
              // 尝试读取图片元数据来检查是否损坏
              await sharp(thumbnailPath).metadata();
            } catch (error) {
              console.log(`🔧 Repairing corrupted thumbnail: ${thumbnailFile}`);
              
              // 删除损坏的缩略图
              await fs.remove(thumbnailPath);
              
              // 重新生成
              const originalFilename = thumbnailFile.replace(`${sizeName}_`, '');
              const originalPath = path.join(this.originalDir, originalFilename);
              
              if (await fs.pathExists(originalPath)) {
                const result = await this.generateThumbnail(originalPath, thumbnailPath, sizeName);
                if (result.success) {
                  repaired++;
                  console.log(`✅ Repaired: ${thumbnailFile}`);
                }
              }
            }
          }
        }
      }
      
      console.log(`🔧 Repaired ${repaired} corrupted thumbnails`);
      return { repaired };
      
    } catch (error) {
      console.error('Error repairing corrupted thumbnails:', error);
      throw error;
    }
  }

  // 工具函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ThumbnailService;