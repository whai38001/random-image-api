const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../utils/logger');

/**
 * 图片处理Worker线程池
 */
class ImageWorkerPool {
  constructor(poolSize = 2) {
    this.poolSize = poolSize;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.isInitialized = false;
    
    this.initializePool();
  }

  /**
   * 初始化Worker线程池
   */
  initializePool() {
    try {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = this.createWorker();
        this.workers.push(worker);
        this.availableWorkers.push(worker);
      }
      
      this.isInitialized = true;
      logger.info(`ImageWorkerPool initialized with ${this.poolSize} workers`);
    } catch (error) {
      logger.error('Failed to initialize ImageWorkerPool', { error: error.message });
      this.isInitialized = false;
    }
  }

  /**
   * 创建单个Worker
   */
  createWorker() {
    const workerPath = path.join(__dirname, 'imageWorker.js');
    const worker = new Worker(workerPath);
    
    worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
      this.handleWorkerError(worker);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warn('Worker exited with error code', { code });
        this.handleWorkerExit(worker);
      }
    });
    
    return worker;
  }

  /**
   * 处理Worker错误
   */
  handleWorkerError(worker) {
    // 从可用Worker列表中移除
    const index = this.availableWorkers.indexOf(worker);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    // 替换损坏的Worker
    try {
      worker.terminate();
      const newWorker = this.createWorker();
      const workerIndex = this.workers.indexOf(worker);
      this.workers[workerIndex] = newWorker;
      this.availableWorkers.push(newWorker);
    } catch (error) {
      logger.error('Failed to replace worker', { error: error.message });
    }
  }

  /**
   * 处理Worker退出
   */
  handleWorkerExit(worker) {
    this.handleWorkerError(worker);
  }

  /**
   * 处理图片任务
   */
  async processImage(task) {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error('Worker pool not initialized'));
        return;
      }

      const taskWithCallbacks = {
        ...task,
        resolve,
        reject,
        timestamp: Date.now()
      };

      if (this.availableWorkers.length > 0) {
        this.executeTask(taskWithCallbacks);
      } else {
        this.taskQueue.push(taskWithCallbacks);
        logger.debug('Task queued - no available workers', { queueLength: this.taskQueue.length });
      }
    });
  }

  /**
   * 执行任务
   */
  executeTask(task) {
    const worker = this.availableWorkers.pop();
    
    const timeout = setTimeout(() => {
      task.reject(new Error('Task timeout'));
      this.returnWorkerToPool(worker);
    }, 30000); // 30秒超时

    const messageHandler = (result) => {
      clearTimeout(timeout);
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);
      
      if (result.success) {
        task.resolve(result.data);
      } else {
        task.reject(new Error(result.error));
      }
      
      this.returnWorkerToPool(worker);
    };

    const errorHandler = (error) => {
      clearTimeout(timeout);
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);
      
      task.reject(error);
      this.handleWorkerError(worker);
    };

    worker.on('message', messageHandler);
    worker.on('error', errorHandler);
    
    // 发送任务到Worker
    worker.postMessage({
      type: task.type,
      inputPath: task.inputPath,
      outputPath: task.outputPath,
      options: task.options
    });

    logger.debug('Task assigned to worker', { 
      type: task.type, 
      availableWorkers: this.availableWorkers.length 
    });
  }

  /**
   * 将Worker返回到池中
   */
  returnWorkerToPool(worker) {
    this.availableWorkers.push(worker);
    
    // 处理队列中的下一个任务
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      this.executeTask(nextTask);
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(inputPath, outputPath, size = 'medium') {
    const sizeOptions = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 500, height: 500 }
    };

    return this.processImage({
      type: 'thumbnail',
      inputPath,
      outputPath,
      options: {
        ...sizeOptions[size],
        quality: 80,
        format: 'jpeg'
      }
    });
  }

  /**
   * 优化图片
   */
  async optimizeImage(inputPath, outputPath, options = {}) {
    const defaultOptions = {
      quality: 80,
      format: 'jpeg',
      maxWidth: 1920,
      maxHeight: 1920
    };

    return this.processImage({
      type: 'optimize',
      inputPath,
      outputPath,
      options: { ...defaultOptions, ...options }
    });
  }

  /**
   * 转换图片格式
   */
  async convertFormat(inputPath, outputPath, format, options = {}) {
    return this.processImage({
      type: 'convert',
      inputPath,
      outputPath,
      options: {
        format,
        quality: options.quality || 80,
        ...options
      }
    });
  }

  /**
   * 批量处理图片
   */
  async processBatch(tasks) {
    const promises = tasks.map(task => this.processImage(task));
    return Promise.allSettled(promises);
  }

  /**
   * 获取池状态
   */
  getStatus() {
    return {
      poolSize: this.poolSize,
      availableWorkers: this.availableWorkers.length,
      queueLength: this.taskQueue.length,
      isInitialized: this.isInitialized,
      totalWorkers: this.workers.length
    };
  }

  /**
   * 关闭Worker池
   */
  async shutdown() {
    logger.info('Shutting down ImageWorkerPool');
    
    // 清空任务队列
    this.taskQueue = [];
    
    // 关闭所有Worker
    const shutdownPromises = this.workers.map(worker => {
      return new Promise((resolve) => {
        worker.terminate().then(resolve).catch(resolve);
      });
    });
    
    await Promise.all(shutdownPromises);
    
    this.workers = [];
    this.availableWorkers = [];
    this.isInitialized = false;
    
    logger.info('ImageWorkerPool shutdown complete');
  }
}

module.exports = ImageWorkerPool;