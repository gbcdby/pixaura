/**
 * ffmpeg wasm IndexedDB 缓存服务
 * 提供 wasm 文件的持久化存储和版本管理
 */

// ==================== 类型定义 ====================

/** ffmpeg 缓存条目 */
interface FfmpegCacheEntry {
  /** 文件名（键） */
  filename: string;
  /** 文件数据（ArrayBuffer） */
  data: ArrayBuffer;
  /** 存入时间戳 */
  createdAt: number;
  /** 文件大小（字节） */
  size: number;
  /** 版本号 */
  version: string;
}

/** 缓存配置 */
interface FfmpegCacheConfig {
  /** 数据库名称 */
  dbName: string;
  /** 存储名称 */
  storeName: string;
  /** ffmpeg 版本号 */
  version: string;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: FfmpegCacheConfig = {
  dbName: "pixaura-ffmpeg-cache",
  storeName: "wasm",
  version: "0.12.9",
};

/** IndexedDB 版本号，仅当 schema 变更时才需要递增 */
const DB_VERSION = 10;

// ==================== ffmpeg 缓存服务 ====================
export class FfmpegCacheService {
  private config: FfmpegCacheConfig;
  private db: IDBDatabase | null = null;
  /** 防止并发初始化 */
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<FfmpegCacheConfig> = {}) {
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
        console.error(`[FfmpegCacheService] IndexedDB 打开失败:`, request.error);
        reject(new Error(`IndexedDB 打开失败: ${request.error?.message}`));
      };

      request.onblocked = () => {
        console.warn(`[FfmpegCacheService] IndexedDB 被阻塞，有其他连接未关闭`);
        reject(new Error("IndexedDB 被阻塞，请关闭其他标签页后重试"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        // 监听连接意外关闭
        this.db.onclose = () => {
          console.warn(`[FfmpegCacheService] IndexedDB 连接意外关闭`);
          this.db = null;
        };
        console.log(`[FfmpegCacheService] IndexedDB 打开成功: ${this.config.dbName} v${DB_VERSION}`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        console.log(`[FfmpegCacheService] IndexedDB 升级: ${this.config.dbName} ${event.oldVersion} -> ${DB_VERSION}`);

        // 只在需要的 store 不存在时创建，避免无条件删除导致数据丢失
        if (!database.objectStoreNames.contains(this.config.storeName)) {
          database.createObjectStore(this.config.storeName, { keyPath: 'filename' });
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
        console.log(`[FfmpegCacheService] 已删除数据库: ${this.config.dbName}`);
        resolve();
      };
      request.onerror = () => {
        console.warn(`[FfmpegCacheService] 删除数据库失败: ${this.config.dbName}`);
        resolve();
      };
      request.onblocked = () => {
        console.warn(`[FfmpegCacheService] 删除数据库被阻塞: ${this.config.dbName}`);
        resolve();
      };
    });
  }

  /** 检查版本是否匹配（以 wasm 文件为准，core.js 始终从本地路径加载） */
  async checkVersion(): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    const entry = await this.getEntry("ffmpeg-core.wasm");
    if (!entry) {
      return false;
    }

    return entry.version === this.config.version;
  }

  /** 获取缓存的 wasm 文件数据 */
  async getWasm(filename: string): Promise<ArrayBuffer | null> {
    if (!this.db) {
      await this.init();
    }

    const entry = await this.getEntry(filename);
    return entry?.data ?? null;
  }

  /** 获取条目 */
  private getEntry(filename: string): Promise<FfmpegCacheEntry | null> {
    if (!this.db) {
      return Promise.resolve(null);
    }

    return new Promise<FfmpegCacheEntry | null>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readonly");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(filename);

      transaction.onerror = () => {
        reject(new Error(`获取缓存事务失败: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`获取缓存事务被中止: ${transaction.error?.message}`));
      };

      request.onerror = () => {
        reject(new Error(`获取缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve((request.result as FfmpegCacheEntry) || null);
      };
    });
  }

  /** 存入 wasm 文件 */
  async setWasm(filename: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const entry: FfmpegCacheEntry = {
      filename,
      data,
      createdAt: Date.now(),
      size: data.byteLength,
      version: this.config.version,
    };

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(this.config.storeName, "readwrite");
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(entry);

      transaction.onerror = () => {
        reject(new Error(`存入缓存事务失败: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`存入缓存事务被中止（可能是存储配额不足）: ${transaction.error?.message}`));
      };

      request.onerror = () => {
        reject(new Error(`存入缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        console.log(`[FfmpegCacheService] 已缓存 wasm: ${filename}, 大小: ${data.byteLength} 字节`);
        resolve();
      };
    });
  }

  /** 从本地 /ffmpeg/ 目录下载 wasm 文件 */
  async downloadWasm(filename: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    const url = `/ffmpeg/${filename}`;
    console.log(`[FfmpegCacheService] 下载 wasm: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载 wasm 失败: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
      const arrayBuffer = await response.arrayBuffer();
      await this.setWasm(filename, arrayBuffer);
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
    await this.setWasm(filename, arrayBuffer);
    onProgress?.(100);
    return arrayBuffer;
  }

  /** 预加载 ffmpeg wasm 文件 */
  async preloadFfmpeg(onProgress?: (progress: number) => void): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    // 检查版本
    const versionOk = await this.checkVersion();
    if (versionOk) {
      console.log("[FfmpegCacheService] ffmpeg 已缓存且版本匹配");
      onProgress?.(100);
      return;
    }

    // 版本不匹配，清理旧缓存（core.js 始终从本地路径加载，只缓存 wasm）
    console.log("[FfmpegCacheService] 版本不匹配，重新下载 wasm");
    await this.clearAll();

    // 只下载 wasm 文件（core.js 由 ff.load() 直接从本地路径加载，不需要缓存）
    onProgress?.(0);
    try {
      const wasmFilename = "ffmpeg-core.wasm";
      await this.downloadWasm(wasmFilename, (progress) => {
        onProgress?.(Math.round(progress));
      });
    } catch (error) {
      console.warn("[FfmpegCacheService] wasm 文件下载失败，将使用内置:", error);
      throw error;
    }

    console.log("[FfmpegCacheService] ffmpeg 预加载完成");
    onProgress?.(100);
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

      transaction.onerror = () => {
        reject(new Error(`清理缓存事务失败: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error(`清理缓存事务被中止: ${transaction.error?.message}`));
      };

      request.onerror = () => {
        reject(new Error(`清理所有缓存失败: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        console.log("[FfmpegCacheService] 已清理所有缓存");
        resolve();
      };
    });
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initPromise = null;
  }
}

/** 全局实例 */
export const ffmpegCacheService = new FfmpegCacheService();
