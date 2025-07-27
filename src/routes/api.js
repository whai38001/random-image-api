const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const Database = require('../models/Database');
const { authenticateSession } = require('../middleware/auth');

const router = express.Router();
const db = new Database();

// 处理OPTIONS预检请求
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendStatus(200);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../public/uploads');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.get('/random', async (req, res) => {
  try {
    // 设置CORS头部，允许跨域访问图片
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    const { category, orientation } = req.query;
    const image = await db.getRandomImage(category, orientation);
    
    if (!image) {
      return res.status(404).json({ error: 'No images found' });
    }

    if (image.is_local) {
      const imagePath = path.join(__dirname, '../../public/uploads', image.filename);
      if (await fs.pathExists(imagePath)) {
        // 设置缓存头部
        res.header('Cache-Control', 'public, max-age=3600');
        res.sendFile(imagePath);
      } else {
        res.status(404).json({ error: 'Image file not found' });
      }
    } else {
      res.redirect(image.url);
    }
  } catch (error) {
    console.error('Error getting random image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/random/json', async (req, res) => {
  try {
    const { category, orientation } = req.query;
    const image = await db.getRandomImage(category, orientation);
    
    if (!image) {
      return res.status(404).json({ error: 'No images found' });
    }

    const imageData = {
      id: image.id,
      filename: image.filename,
      category: image.category,
      orientation: image.orientation,
      created_at: image.created_at
    };

    if (image.is_local) {
      imageData.url = `/api/images/${image.id}`;
    } else {
      imageData.url = image.url;
    }

    res.json(imageData);
  } catch (error) {
    console.error('Error getting random image data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/images', async (req, res) => {
  try {
    const { category, orientation, page = 1, limit = 12 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (req.query.paginated === 'false') {
      // 兼容原有的获取所有图片的逻辑
      let images;
      
      if (category && orientation) {
        images = await db.getImagesByCategory(category);
        images = images.filter(img => img.orientation === orientation);
      } else if (category) {
        images = await db.getImagesByCategory(category);
      } else if (orientation) {
        images = await db.getImagesByOrientation(orientation);
      } else {
        images = await db.getAllImages();
      }
      
      res.json(images);
    } else {
      // 默认使用分页
      const result = await db.getImagesPaginated(pageNum, limitNum, category, orientation);
      res.json(result);
    }
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/images/:id', async (req, res) => {
  try {
    // 设置CORS头部，允许跨域访问图片
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    const image = await db.getImageById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.is_local) {
      const imagePath = path.join(__dirname, '../../public/uploads', image.filename);
      if (await fs.pathExists(imagePath)) {
        // 设置缓存头部
        res.header('Cache-Control', 'public, max-age=3600');
        res.sendFile(imagePath);
      } else {
        res.status(404).json({ error: 'Image file not found' });
      }
    } else {
      res.redirect(image.url);
    }
  } catch (error) {
    console.error('Error getting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/images', authenticateSession, upload.single('image'), async (req, res) => {
  try {
    const { category, orientation, url } = req.body;
    
    if (!category || !orientation) {
      return res.status(400).json({ error: 'Category and orientation are required' });
    }

    let imageData;

    if (req.file) {
      const metadata = await sharp(req.file.path).metadata();
      const detectedOrientation = metadata.width > metadata.height ? 'landscape' : 'portrait';
      
      // 生成缩略图
      const thumbnailFilename = 'thumb_' + req.file.filename;
      const thumbnailPath = path.join(__dirname, '../../public/uploads/thumbnails', thumbnailFilename);
      
      // 确保缩略图目录存在
      fs.ensureDirSync(path.join(__dirname, '../../public/uploads/thumbnails'));
      
      // 创建200x200缩略图
      await sharp(req.file.path)
        .resize(200, 200, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      imageData = {
        filename: req.file.filename,
        original_name: req.file.originalname,
        category,
        orientation: orientation || detectedOrientation,
        url: null,
        is_local: 1,
        thumbnail: thumbnailFilename
      };
    } else if (url) {
      imageData = {
        filename: '',
        original_name: '',
        category,
        orientation,
        url,
        is_local: 0,
        thumbnail: null
      };
    } else {
      return res.status(400).json({ error: 'Either file upload or URL is required' });
    }

    const result = await db.addImage(imageData);
    res.json(result);
  } catch (error) {
    console.error('Error adding image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/images/:id', authenticateSession, upload.single('image'), async (req, res) => {
  try {
    const { category, orientation, url } = req.body;
    const imageId = req.params.id;
    
    const existingImage = await db.getImageById(imageId);
    if (!existingImage) {
      return res.status(404).json({ error: 'Image not found' });
    }

    let imageData = {
      filename: existingImage.filename,
      original_name: existingImage.original_name,
      category: category || existingImage.category,
      orientation: orientation || existingImage.orientation,
      url: existingImage.url,
      is_local: existingImage.is_local
    };

    if (req.file) {
      if (existingImage.is_local && existingImage.filename) {
        const oldPath = path.join(__dirname, '../../public/uploads', existingImage.filename);
        await fs.remove(oldPath).catch(console.error);
      }
      
      const metadata = await sharp(req.file.path).metadata();
      const detectedOrientation = metadata.width > metadata.height ? 'landscape' : 'portrait';
      
      imageData.filename = req.file.filename;
      imageData.original_name = req.file.originalname;
      imageData.orientation = orientation || detectedOrientation;
      imageData.url = null;
      imageData.is_local = 1;
    } else if (url) {
      imageData.url = url;
      imageData.is_local = 0;
    }

    await db.updateImage(imageId, imageData);
    res.json({ message: 'Image updated successfully' });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/images/:id', authenticateSession, async (req, res) => {
  try {
    const imageId = req.params.id;
    const image = await db.getImageById(imageId);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.is_local && image.filename) {
      const imagePath = path.join(__dirname, '../../public/uploads', image.filename);
      await fs.remove(imagePath).catch(console.error);
    }

    await db.deleteImage(imageId);
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 缩略图访问路由
router.get('/thumbnails/:filename', async (req, res) => {
  try {
    // 设置CORS头部
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    const thumbnailPath = path.join(__dirname, '../../public/uploads/thumbnails', req.params.filename);
    
    if (await fs.pathExists(thumbnailPath)) {
      // 设置缓存头部
      res.header('Cache-Control', 'public, max-age=86400'); // 24小时缓存
      res.sendFile(thumbnailPath);
    } else {
      res.status(404).json({ error: 'Thumbnail not found' });
    }
  } catch (error) {
    console.error('Error getting thumbnail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;