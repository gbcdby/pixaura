import { ref, type Ref } from "vue";

/**
 * 裁切区域接口（百分比坐标 0-1）
 */
interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * useImageCrop - 图片裁切 Composable
 * 用于根据百分比坐标裁切图片，生成 base64 数据
 * 主要用于对口型视频生成时的角色框选区域裁切
 */

interface UseImageCropReturn {
  /** 是否正在裁切 */
  isCropping: Ref<boolean>;
  /** 裁切单张图片的指定区域 */
  cropImage: (imageUrl: string, region: CropRegion) => Promise<Blob>;
  /** 批量裁切多个区域 */
  cropMultipleRegions: (imageUrl: string, regions: CropRegion[]) => Promise<Blob[]>;
}

export function useImageCrop(): UseImageCropReturn {
  // 是否正在裁切
  const isCropping = ref(false);

  /**
   * 加载图片到 Image 对象
   */
  async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.crossOrigin = "anonymous";

    return new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = imageUrl;
    });
  }

  /**
   * 裁切单张图片的指定区域
   * @param imageUrl 原图 URL
   * @param region 裁切区域（百分比坐标 0-1）
   * @returns Blob 格式的裁切图片（image/png）
   */
  async function cropImage(imageUrl: string, region: CropRegion): Promise<Blob> {
    isCropping.value = true;

    try {
      // 加载原图
      const img = await loadImage(imageUrl);

      // 计算实际像素坐标
      const x = Math.round(region.x * img.naturalWidth);
      const y = Math.round(region.y * img.naturalHeight);
      const width = Math.round(region.width * img.naturalWidth);
      const height = Math.round(region.height * img.naturalHeight);

      // 边界检查，防止超出图片范围
      const clampedX = Math.max(0, Math.min(x, img.naturalWidth - 1));
      const clampedY = Math.max(0, Math.min(y, img.naturalHeight - 1));
      const clampedWidth = Math.max(1, Math.min(width, img.naturalWidth - clampedX));
      const clampedHeight = Math.max(1, Math.min(height, img.naturalHeight - clampedY));

      // 创建 Canvas
      const canvas = document.createElement("canvas");
      canvas.width = clampedWidth;
      canvas.height = clampedHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("无法创建 Canvas context");
      }

      // 裁切指定区域
      // drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      // sx, sy - 源图片裁切起点
      // sWidth, sHeight - 源图片裁切尺寸
      // dx, dy - 目标 Canvas 绘制起点（0, 0）
      // dWidth, dHeight - 目标 Canvas 绘制尺寸（与裁切尺寸相同）
      ctx.drawImage(
        img,
        clampedX,
        clampedY,
        clampedWidth,
        clampedHeight,
        0,
        0,
        clampedWidth,
        clampedHeight
      );

      // 导出为 Blob 格式（比 base64 节省约 33% 体积）
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error("Canvas 导出 Blob 失败"));
            }
          },
          "image/png",
          0.95
        );
      });

      return blob;
    } finally {
      isCropping.value = false;
    }
  }

  /**
   * 批量裁切多个区域
   * @param imageUrl 原图 URL
   * @param regions 裁切区域列表（百分比坐标 0-1）
   * @returns Blob 格式的裁切图片列表
   */
  async function cropMultipleRegions(imageUrl: string, regions: CropRegion[]): Promise<Blob[]> {
    isCropping.value = true;

    try {
      // 加载原图（只需加载一次）
      const img = await loadImage(imageUrl);

      const results: Blob[] = [];

      for (const region of regions) {
        // 计算实际像素坐标
        const x = Math.round(region.x * img.naturalWidth);
        const y = Math.round(region.y * img.naturalHeight);
        const width = Math.round(region.width * img.naturalWidth);
        const height = Math.round(region.height * img.naturalHeight);

        // 边界检查
        const clampedX = Math.max(0, Math.min(x, img.naturalWidth - 1));
        const clampedY = Math.max(0, Math.min(y, img.naturalHeight - 1));
        const clampedWidth = Math.max(1, Math.min(width, img.naturalWidth - clampedX));
        const clampedHeight = Math.max(1, Math.min(height, img.naturalHeight - clampedY));

        // 创建 Canvas
        const canvas = document.createElement("canvas");
        canvas.width = clampedWidth;
        canvas.height = clampedHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("无法创建 Canvas context");
        }

        // 裁切指定区域
        ctx.drawImage(
          img,
          clampedX,
          clampedY,
          clampedWidth,
          clampedHeight,
          0,
          0,
          clampedWidth,
          clampedHeight
        );

        // 导出为 Blob（比 base64 节省约 33% 体积）
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) {
                resolve(b);
              } else {
                reject(new Error("Canvas 导出 Blob 失败"));
              }
            },
            "image/png",
            0.95
          );
        });
        results.push(blob);
      }

      return results;
    } finally {
      isCropping.value = false;
    }
  }

  return {
    isCropping,
    cropImage,
    cropMultipleRegions,
  };
}