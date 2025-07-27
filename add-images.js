const Database = require('./src/models/Database');

async function addHighQualityImages() {
  const db = new Database();
  
  console.log('🎨 开始添加100张高质量图片...');
  
  // 定义图片URL数据
  const images = [
    // 风景类 - 横屏图片 (20张)
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1464822759844-d150baef493e?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1485470733090-0aae1788d5af?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1421789665209-c9b2a435e3dc?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1465189684280-6a8fa9b19a7a?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop', category: 'landscape', orientation: 'landscape' },

    // 风景类 - 竖屏图片 (5张)
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1920&fit=crop', category: 'landscape', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&h=1920&fit=crop', category: 'landscape', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1080&h=1920&fit=crop', category: 'landscape', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1080&h=1920&fit=crop', category: 'landscape', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1464822759844-d150baef493e?w=1080&h=1920&fit=crop', category: 'landscape', orientation: 'portrait' },

    // 动漫类图片 (15张) - 使用动漫风格插画
    { url: 'https://cdn.pixabay.com/photo/2024/01/15/17/41/anime-8509776_1280.png?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2023/09/28/12/34/anime-8281126_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2024/02/28/16/25/ai-generated-8602068_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2023/12/12/16/31/ai-generated-8445570_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2024/01/24/19/09/ai-generated-8530311_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2023/11/07/10/46/ai-generated-8371345_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2024/02/05/18/38/ai-generated-8555516_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2023/10/24/06/33/ai-generated-8337244_1280.jpg?w=1920&h=1080&fit=crop', category: 'anime', orientation: 'landscape' },
    { url: 'https://cdn.pixabay.com/photo/2024/01/15/17/41/anime-8509776_1280.png?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2023/09/28/12/34/anime-8281126_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2024/02/28/16/25/ai-generated-8602068_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2023/12/12/16/31/ai-generated-8445570_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2024/01/24/19/09/ai-generated-8530311_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2023/11/07/10/46/ai-generated-8371345_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },
    { url: 'https://cdn.pixabay.com/photo/2024/02/05/18/38/ai-generated-8555516_1280.jpg?w=1080&h=1920&fit=crop', category: 'anime', orientation: 'portrait' },

    // 美女类图片 (15张)
    { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1494790108755-2616c5e44db6?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1920&h=1080&fit=crop', category: 'beauty', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1494790108755-2616c5e44db6?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1080&h=1920&fit=crop', category: 'beauty', orientation: 'portrait' },

    // 自然类图片 (15张)
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1434394354979-a235cd36269d?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1508615263227-e2bfd1e2b9da?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop', category: 'nature', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1434394354979-a235cd36269d?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1508615263227-e2bfd1e2b9da?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1482938289607-e9573fc25ebb?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1510627489930-0c1b0e0c6953?w=1080&h=1920&fit=crop', category: 'nature', orientation: 'portrait' },

    // 城市类图片 (15张)
    { url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1520637836862-4d197d17c99a?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=1920&h=1080&fit=crop', category: 'city', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1520637836862-4d197d17c99a?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1506452819137-0422416856b8?w=1080&h=1920&fit=crop', category: 'city', orientation: 'portrait' },

    // 艺术类图片 (15张)
    { url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1569701722768-a34015926c84?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1577720643271-94c9b6200400?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop', category: 'art', orientation: 'landscape' },
    { url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1569701722768-a34015926c84?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1577720643271-94c9b6200400?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' },
    { url: 'https://images.unsplash.com/photo-1533158307587-38cdcaac2609?w=1080&h=1920&fit=crop', category: 'art', orientation: 'portrait' }
  ];

  console.log(`准备添加 ${images.length} 张图片...`);
  
  let successCount = 0;
  let errorCount = 0;

  // 批量添加图片
  for (let i = 0; i < images.length; i++) {
    const imageData = {
      filename: '',
      original_name: `High Quality Image ${i + 1}`,
      category: images[i].category,
      orientation: images[i].orientation,
      url: images[i].url,
      is_local: 0
    };

    try {
      await db.addImage(imageData);
      successCount++;
      console.log(`✅ 添加成功 ${successCount}/${images.length}: ${images[i].category} - ${images[i].orientation}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ 添加失败 ${errorCount}: ${error.message}`);
    }
  }

  console.log('\n🎯 图片添加完成！');
  console.log(`✅ 成功添加: ${successCount} 张`);
  console.log(`❌ 添加失败: ${errorCount} 张`);
  console.log(`📊 总计: ${successCount + errorCount} 张`);
  
  // 显示分类统计
  console.log('\n📋 分类统计:');
  const categories = ['landscape', 'anime', 'beauty', 'nature', 'city', 'art'];
  for (const category of categories) {
    const categoryImages = images.filter(img => img.category === category);
    const landscapeCount = categoryImages.filter(img => img.orientation === 'landscape').length;
    const portraitCount = categoryImages.filter(img => img.orientation === 'portrait').length;
    console.log(`${category}: ${categoryImages.length} 张 (横屏: ${landscapeCount}, 竖屏: ${portraitCount})`);
  }

  process.exit(0);
}

// 运行添加图片脚本
addHighQualityImages().catch(console.error);