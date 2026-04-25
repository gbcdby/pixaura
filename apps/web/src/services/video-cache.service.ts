/**
 * 视频数据 IndexedDB 缓存服务
 * 提供 ArrayBuffer 的持久化存储， LRU 缓存管理
 */

// ==================== 类型定义 ====================

/** 缓存条目 */
interface VideoCacheEntry {
  /** 视频 URL（键） */
  url: string;
  /** 视频数据（ArrayBuffer） */
  data: ArrayBuffer;
  /** 存入时间戳 */
  createdAt: number;
  /** 最后访问时间戳 */
  lastAccessedAt: number;
  /** 数据大小（字节） */
  size: number;
}

/** 缓存统计信息 */
export interface CacheStats {
  /** 总条目数 */
  totalEntries: number;
  /** 总容量（字节） */
  totalSize: number;
  /** 最大容量（字节） */
  maxCapacity: number;
  /** 使用率百分比 */
  usagePercent: number;
}

/** 缓存配置 */
interface CacheConfig {
  /** 数据库名称 */
  dbName: string;
  /** 存储名称 */
  storeName: string;
  /** 最大容量（字节），默认 500MB */
  maxCapacity: number;
  /** 过期时间（毫秒）， 默认 7 天 */
  expireTime: number;
  /** LRU 未访问过期时间（毫秒）， 默认 3 天 */
  lruExpireTime: number;
  /** 定期清理间隔（毫秒）， 默认 1 小时 */
  cleanupInterval: number;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: CacheConfig = {
  dbName: "pixaura-video-cache",
  storeName: "videos",
  maxCapacity: 500 * 1024 * 1024, // 500MB
  expireTime: 7 * 24 * 60 * 60 * 1000, // 7 天
  lruExpireTime: 3 * 24 * 60 * 60 * 1000, // 3 天
  cleanupInterval: 60 * 60 * 1000, // 1 小时
};

/** IndexedDB 版本号，仅当 schema 变更时才需要递增 */
const DB_VERSION = 10;

// =================--- 视频缓存服务 ====================

export class VideoCacheService {
  private config: CacheConfig;
  private db: IDBDatabase | null = null;
  private cleanupTimerId: ReturnType<typeof setInterval> | null = null;
  private currentSize: number = 0;
  /** 防止并发初始化 */
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 初始化数据库 */
  async init(): Promise<void> {
    // 已正常连接，直接返回
    if (this.db) {
      return;
    }
    // 正在初始化中，复用同一个 Promise
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    try {
      await this.initPromise;
    } catch (error) {
      // 初始化失败时重置，允许下次重试
      this.initPromise = null;
      throw error;
    }
  }

  private doInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, DB_VERSION);

      request.onerror = () => {
        console.error(`[VideoCacheService] IndexedDB 打开失败:`, request.error);
        reject(new Error(`IndexedDB 打开失败: ${request.error?.message}`));
      };

      request.onblocked = () => {
        console.warn(`[VideoCacheService] IndexedDB 被阻塞，有其他连接未关闭`);
      };

      request.onsuccess = () => {
        this.db = request.result;
        // 监听连接意外关闭
        this.db.onclose = () => {
          console.warn(`[VideoCacheService] IndexedDB 连接意外关闭`);
          this.db = null;
        };
        this.startCleanup();
        console.log(`[VideoCacheService] IndexedDB 打开成功: ${this.config.dbName} v${DB_VERSION}`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        console.log(`[VideoCacheService] IndexedDB 升级: ${this.config.dbName} ${event.oldVersion} -> ${DB_VERSION}`);

        // 只在需要的 store 不存在时创建，避免无条件删除导致数据丢失
        if (!database.objectStoreNames.contains(this.config.storeName)) {
          database.createObjectStore(this.config.storeName, { keyPath: 'url' });
        }
      };
    });
  }

  /** 强制删除数据库（用于清理损坏的缓存） */
  async deleteDatabase(): Promise<void> {
    this.close();

    return new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(this.config.dbName);
      request.onsuccess = () => {
        console.log(`[VideoCacheService] 已删除数据库: ${this.config.dbName}`);
        resolve();
      };
      request.onerror = () => {
        console.warn(`[VideoCacheService] 删除数据库失败: ${this.config.dbName}`);
        resolve();
      };
      request.onblocked = () => {
        console.warn(`[VideoCacheService] 删除数据库被阻塞: ${this.config.dbName}`);
        resolve();
      };
    });
  }

  /** 启动定期清理 */
  private startCleanup(): void {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
    }
    this.cleanupTimerId = setInterval(() => {
      this.cleanup().catch((error) => {
        console.error("[VideoCacheService] 清理失败:", error);
      });
    }, this.config.cleanupInterval);
  }

  /** 执行清理策略 */
  async cleanup(): Promise<void> {
    if (!this.db) {
      return;
    }

    const now = Date.now();
    const entries = await this.getAllEntries();

    const toDelete: VideoCacheEntry[] = [];

    for (const entry of entries) {
      // 时间过期： 存入超过 7 天
      if (now - entry.createdAt > this.config.expireTime) {
        toDelete.push(entry);
        continue;
      }
      // LRU 未访问过期: 未访问超过 3 天
      if (now - entry.lastAccessedAt > this.config.lruExpireTime) {
        toDelete.push(entry);
      }
    }

    // 删除过期条目
    for (const entry of toDelete) {
      await this.delete(entry.url);
    }

    // 容量管理: 如果超过上限， 清理最旧数据
    const stats = await this.getStats();
    if (stats.totalSize > this.config.maxCapacity) {
      // 按存入时间排序， 最旧的先清理
      const allEntries = entries.sort((a, b) => a.createdAt - b.createdAt);
      const neededSpace = stats.totalSize - this.config.maxCapacity;

      let freedSpace = 0;
      for (const entry of allEntries) {
        if (freedSpace >= neededSpace) {
          break;
        }
        await this.delete(entry.url);
        freedSpace += entry.size;
      }
    }
  }

  /** 获取所有条目 */
  private async getAllEntries(): Promise<VideoCacheEntry[]> {
    if (!this.db) {
      return Promise.resolve([]);
    }

    return new Promise<VideoCacheEntry[]>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readonly");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error(`获取所有条目失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve((request.result as VideoCacheEntry[]) || []);
      };
    });
  }

  /** 获取缓存统计信息 */
  async getStats(): Promise<CacheStats> {
    const entries = await this.getAllEntries();
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

    return {
      totalEntries: entries.length,
      totalSize,
      maxCapacity: this.config.maxCapacity,
      usagePercent: Math.round((totalSize / this.config.maxCapacity) * 100),
    };
  }

  /** 获取视频数据（优先缓存，不自动下载） */
  async getVideo(url: string): Promise<ArrayBuffer | null> {
    if (!this.db) {
      await this.init();
    }

    // 尝试从缓存获取
    return this.getCached(url);
  }

  /** 从缓存获取视频 */
  private getCached(url: string): Promise<ArrayBuffer | null> {
    if (!this.db) {
      return Promise.resolve(null);
    }

    return new Promise<ArrayBuffer | null>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readonly");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(url);

      request.onerror = () => {
        reject(new Error(`获取缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const entry = request.result as VideoCacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // 更新访问时间（LRU）
        this.updateAccessTime(url).catch(() => {});
        resolve(entry.data);
      };
    });
  }

  /** 更新访问时间 */
  private updateAccessTime(url: string): Promise<void> {
    if (!this.db) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const getRequest = store.get(url);

      getRequest.onerror = () => {
        reject(new Error(`获取条目失败: ${getRequest.error?.message}`));
      };

      getRequest.onsuccess = () => {
        const entry = getRequest.result as VideoCacheEntry | undefined;
        if (!entry) {
          resolve();
          return;
        }

        entry.lastAccessedAt = Date.now();
        const putRequest = store.put(entry);

        putRequest.onerror = () => {
          reject(new Error(`更新访问时间失败: ${putRequest.error?.message}`));
        };

        putRequest.onsuccess = () => {
          resolve();
        };
      };
    });
  }

  /** 存入视频数据 */
  async setVideo(url: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const entry: VideoCacheEntry = {
      url,
      data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      size: data.byteLength,
    };

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(entry);

      request.onerror = () => {
        reject(new Error(`存入缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.currentSize += data.byteLength;
        console.log(`[VideoCacheService] 已缓存视频: ${url}, 大小: ${data.byteLength} 字节`);
        resolve();
      };
    });
  }

  /** 删除缓存条目 */
  async delete(url: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(url);

      request.onerror = () => {
        reject(new Error(`删除缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /** 预加载视频（下载并存入缓存） */
  async preloadVideo(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    if (!this.db) {
      await this.init();
    }

    // 先检查缓存
    const cached = await this.getCached(url);
    if (cached) {
      onProgress?.(100);
      return cached;
    }

    // 从远程下载
    console.log(`[VideoCacheService] 预加载视频: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
      const arrayBuffer = await response.arrayBuffer();
      await this.setVideo(url, arrayBuffer);
      onProgress?.(100);
      return arrayBuffer;
    }

    // 按块下载并报告进度
    const chunks: Uint8Array[] = [];
    let receivedSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      receivedSize += value.length;
      if (totalSize > 0) {
        onProgress?.(Math.round((receivedSize / totalSize) * 100));
      }
    }

    // 合并所有块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const arrayBuffer = new ArrayBuffer(totalLength);
    const combinedArray = new Uint8Array(arrayBuffer);

    let offset = 0;
    for (const chunk of chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    // 存入缓存
    await this.setVideo(url, arrayBuffer);
    onProgress?.(100);
    return arrayBuffer;
  }

  /** 清理所有缓存 */
  async clearAll(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`清理所有缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.currentSize = 0;
        resolve();
      };
    });
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initPromise = null;
  }
}

/** 全局实例 */
export const videoCacheService = new VideoCacheService();
