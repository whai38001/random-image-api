const express = require('express');
const ThumbnailService = require('../services/ThumbnailService');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();
const thumbnailService = new ThumbnailService();

// 中间件：只允许管理员访问
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 获取缩略图统计信息
router.get('/stats', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const stats = await thumbnailService.getThumbnailStats();
    res.json(stats);
  } catch (error) {
    console.error('Get thumbnail stats error:', error);
    res.status(500).json({ error: '获取缩略图统计失败' });
  }
});

// 批量生成缺失的缩略图
router.post('/generate-missing', authenticateSession, requireAdmin, async (req, res) => {
  try {
    // 异步执行，不阻塞响应
    thumbnailService.generateMissingThumbnails()
      .then(summary => {
        console.log('📊 Batch thumbnail generation completed:', summary);
      })
      .catch(error => {
        console.error('❌ Batch thumbnail generation failed:', error);
      });
    
    res.json({
      success: true,
      message: '缩略图生成任务已启动，请稍后查看统计信息了解进度'
    });
  } catch (error) {
    console.error('Start thumbnail generation error:', error);
    res.status(500).json({ error: '启动缩略图生成失败' });
  }
});

// 清理孤立的缩略图
router.post('/cleanup-orphaned', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const result = await thumbnailService.cleanupOrphanedThumbnails();
    res.json({
      success: true,
      message: `已清理 ${result.cleaned} 个孤立的缩略图`,
      ...result
    });
  } catch (error) {
    console.error('Cleanup orphaned thumbnails error:', error);
    res.status(500).json({ error: '清理孤立缩略图失败' });
  }
});

// 修复损坏的缩略图
router.post('/repair-corrupted', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const result = await thumbnailService.repairCorruptedThumbnails();
    res.json({
      success: true,
      message: `已修复 ${result.repaired} 个损坏的缩略图`,
      ...result
    });
  } catch (error) {
    console.error('Repair corrupted thumbnails error:', error);
    res.status(500).json({ error: '修复损坏缩略图失败' });
  }
});

// 为特定图片生成缩略图
router.post('/generate/:imageId', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { imageId } = req.params;
    const Database = require('../models/Database');
    const db = new Database();
    
    const image = await db.getImageById(imageId);
    
    if (!image) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    if (!image.is_local || !image.filename) {
      return res.status(400).json({ error: '只能为本地图片生成缩略图' });
    }
    
    const imagePath = require('path').join(__dirname, '../../public/uploads', image.filename);
    const results = await thumbnailService.generateMultipleThumbnails(imagePath, image.filename);
    
    const allSuccessful = Object.values(results).every(result => result.success);
    
    if (allSuccessful) {
      // 更新数据库
      await thumbnailService.updateImageThumbnail(image.id, image.filename);
      
      res.json({
        success: true,
        message: '缩略图生成成功',
        results
      });
    } else {
      res.status(500).json({
        success: false,
        message: '部分缩略图生成失败',
        results
      });
    }
  } catch (error) {
    console.error('Generate thumbnail for image error:', error);
    res.status(500).json({ error: '生成缩略图失败' });
  }
});

// 获取缩略图 (支持不同尺寸)
router.get('/:size/:filename', async (req, res) => {
  try {
    const { size, filename } = req.params;
    
    // 验证尺寸参数
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) {
      return res.status(400).json({ error: '无效的缩略图尺寸' });
    }
    
    // 设置CORS头部
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    const thumbnailPath = thumbnailService.getThumbnailPath(filename, size);
    
    if (!thumbnailPath) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    const fs = require('fs-extra');
    
    if (await fs.pathExists(thumbnailPath)) {
      // 设置缓存头部 - 缩略图缓存更长时间
      res.header('Cache-Control', 'public, max-age=604800'); // 7天缓存
      res.sendFile(thumbnailPath);
    } else {
      // 如果缩略图不存在，尝试即时生成
      const Database = require('../models/Database');
      const db = new Database();
      
      // 查找原图
      const originalFilename = filename.replace(/^(small|medium|large)_/, '');
      const images = await db.getAllImages();
      const image = images.find(img => img.filename === originalFilename);
      
      if (image && image.is_local) {
        const originalPath = require('path').join(__dirname, '../../public/uploads', image.filename);
        
        if (await fs.pathExists(originalPath)) {
          console.log(`🔄 Generating missing thumbnail on-demand: ${size}_${filename}`);
          
          const result = await thumbnailService.generateThumbnail(originalPath, thumbnailPath, size);
          
          if (result.success) {
            res.header('Cache-Control', 'public, max-age=604800');
            res.sendFile(thumbnailPath);
          } else {
            res.status(500).json({ error: '生成缩略图失败' });
          }
        } else {
          res.status(404).json({ error: '原图文件不存在' });
        }
      } else {
        res.status(404).json({ error: '缩略图不存在' });
      }
    }
  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).json({ error: '获取缩略图失败' });
  }
});

// 删除特定图片的所有缩略图
router.delete('/:filename', authenticateSession, requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs-extra');
    const path = require('path');
    
    let deleted = 0;
    
    for (const size of ['small', 'medium', 'large']) {
      const thumbnailPath = path.join(__dirname, '../../public/uploads/thumbnails', size, `${size}_${filename}`);
      
      if (await fs.pathExists(thumbnailPath)) {
        await fs.remove(thumbnailPath);
        deleted++;
      }
    }
    
    res.json({
      success: true,
      message: `已删除 ${deleted} 个缩略图`,
      deleted
    });
  } catch (error) {
    console.error('Delete thumbnails error:', error);
    res.status(500).json({ error: '删除缩略图失败' });
  }
});

module.exports = router;