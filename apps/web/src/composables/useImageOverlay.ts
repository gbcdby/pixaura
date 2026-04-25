import { ref, watch, onUnmounted, type Ref } from "vue";

/**
 * 角色框选区域接口
 */
interface CharacterRegion {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

/**
 * 角色框选配置接口
 */
interface CharacterOverlayConfig {
  characterId: string;
  characterName?: string; // 可选，如果不提供则不显示标签
  region: CharacterRegion;
  isManual: boolean;
  color: string;
}

/**
 * useImageOverlay - 图片叠加层合成 Composable
 * 用于将角色框选区域和标签合成到图片上，生成 base64 数据
 * 支持 n-image 自带的预览功能
 */

interface UseImageOverlayOptions {
  /** 原图 URL */
  imageUrl: Ref<string | undefined>;
  /** 角色框选配置列表 */
  overlays: Ref<CharacterOverlayConfig[]>;
  /** 是否启用合成（默认 true） */
  enabled?: Ref<boolean>;
  /** 是否显示标签（默认 true） */
  showLabels?: boolean;
  /** 是否显示蒙层（框选区域外的半透明遮罩，默认 false） */
  showMask?: boolean;
  /** 蒙层透明度（0-1，默认 0.5） */
  maskOpacity?: number;
}

interface UseImageOverlayReturn {
  /** 合成后的图片 URL（base64 或 blob URL） */
  composedImageUrl: Ref<string | undefined>;
  /** 是否正在合成 */
  isComposing: Ref<boolean>;
  /** 合成错误信息 */
  composeError: Ref<string | undefined>;
  /** 手动触发重新合成 */
  recompose: () => void;
}

export function useImageOverlay(options: UseImageOverlayOptions): UseImageOverlayReturn {
  const { imageUrl, overlays, enabled, showLabels = true, showMask = false, maskOpacity = 0.5 } = options;

  // 合成后的图片 URL
  const composedImageUrl = ref<string | undefined>(undefined);
  // 是否正在合成
  const isComposing = ref(false);
  // 合成错误
  const composeError = ref<string | undefined>(undefined);

  // 存储之前的 blob URL，用于清理
  let previousBlobUrl: string | undefined = undefined;

  /**
   * 合成图片
   */
  async function composeImage(): Promise<void> {
    // 清理之前的 URL
    if (previousBlobUrl) {
      URL.revokeObjectURL(previousBlobUrl);
      previousBlobUrl = undefined;
    }

    // 如果没有图片或禁用合成，直接返回原图
    if (!imageUrl.value) {
      composedImageUrl.value = undefined;
      return;
    }

    // 如果没有叠加层或禁用合成，直接使用原图
    if (!overlays.value || overlays.value.length === 0 || (enabled !== undefined && !enabled.value)) {
      composedImageUrl.value = imageUrl.value;
      return;
    }

    isComposing.value = true;
    composeError.value = undefined;

    try {
      // 加载原图
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = imageUrl.value!;
      });

      // 创建 Canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("无法创建 Canvas context");
      }

      // 绘制原图
      ctx.drawImage(img, 0, 0);

      // 如果需要显示蒙层，先绘制蒙层
      if (showMask && overlays.value.length > 0) {
        drawMaskLayer(ctx, overlays.value, canvas.width, canvas.height, maskOpacity);
      }

      // 绘制每个角色框选区域
      for (const overlay of overlays.value) {
        drawOverlay(ctx, overlay, canvas.width, canvas.height, showLabels);
      }

      // 导出为 blob URL（比 base64 更高效）
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas 导出失败"));
            }
          },
          "image/png",
          0.95
        );
      });

      previousBlobUrl = URL.createObjectURL(blob);
      composedImageUrl.value = previousBlobUrl;
    } catch (error) {
      composeError.value = (error as Error).message;
      // 合成失败时 fallback 到原图
      composedImageUrl.value = imageUrl.value;
    } finally {
      isComposing.value = false;
    }
  }

  /**
   * 绘制蒙层（框选区域外的半透明遮罩）
   * 使用 clip 方法确保框选区域完全透明，没有任何覆盖
   */
  function drawMaskLayer(
    ctx: CanvasRenderingContext2D,
    overlays: CharacterOverlayConfig[],
    canvasWidth: number,
    canvasHeight: number,
    opacity: number
  ): void {
    // 保存当前状态
    ctx.save();

    // 创建一个覆盖整个画布的路径，然后挖空框选区域
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);

    // 使用 evenodd 填充规则，使得框选区域被"挖空"
    for (const overlay of overlays) {
      const x = overlay.region.x * canvasWidth;
      const y = overlay.region.y * canvasHeight;
      const width = overlay.region.width * canvasWidth;
      const height = overlay.region.height * canvasHeight;
      ctx.rect(x, y, width, height);
    }

    // 使用 evenodd 填充规则，只在框选区域外绘制蒙层
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fill("evenodd");

    // 恢复状态
    ctx.restore();
  }

  /**
   * 绘制单个角色框选区域
   */
  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: CharacterOverlayConfig,
    canvasWidth: number,
    canvasHeight: number,
    shouldShowLabels: boolean
  ): void {
    const { region, isManual, color } = overlay;

    // 计算实际像素坐标
    const x = region.x * canvasWidth;
    const y = region.y * canvasHeight;
    const width = region.width * canvasWidth;
    const height = region.height * canvasHeight;

    // 绘制半透明背景（框选区域内的高亮效果，仅在非蒙层模式下显示）
    if (!showMask) {
      ctx.fillStyle = `${color}20`; // 20 为透明度（十六进制）
      ctx.fillRect(x, y, width, height);
    }

    // 绘制边框
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash(isManual ? [] : [6, 4]); // 手动框选用实线，自动检测用虚线
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]); // 重置为实线

    // 绘制角落标记
    const cornerSize = 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;

    // 左上角
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();

    // 右上角
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerSize);
    ctx.stroke();

    // 左下角
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerSize);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerSize, y + height);
    ctx.stroke();

    // 右下角
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerSize);
    ctx.stroke();

    // 绘制角色名称标签（如果需要）
    if (shouldShowLabels && overlay.characterName) {
      drawLabel(ctx, overlay.characterName, x, y, color);
    }
  }

  /**
   * 绘制角色名称标签
   */
  function drawLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string
  ): void {
    const padding = 6;
    const fontSize = 14;
    const borderRadius = 4;

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    // 计算文本宽度
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const labelWidth = textWidth + padding * 2;
    const labelHeight = fontSize + padding;

    // 标签位置（框选区域上方）
    const labelX = x;
    const labelY = y - labelHeight - 4;
    const actualLabelY = labelY < 0 ? y + 4 : labelY; // 如果超出顶部，则放在框内

    // 绘制标签背景（圆角矩形）
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx, labelX, actualLabelY, labelWidth, labelHeight, borderRadius);
    ctx.fill();

    // 绘制文本
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.fillText(text, labelX + padding, actualLabelY + (labelHeight - fontSize) / 2);
  }

  /**
   * 绘制圆角矩形
   */
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  /**
   * 深度比较两个 CharacterOverlayConfig 数组的内容是否相等
   * 用于避免 overlays 引用变化但内容未变时触发不必要的重新合成
   */
  function isOverlaysEqual(
    a: CharacterOverlayConfig[],
    b: CharacterOverlayConfig[],
  ): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const oa = a[i];
      const ob = b[i];
      if (
        oa.characterId !== ob.characterId ||
        oa.characterName !== ob.characterName ||
        oa.isManual !== ob.isManual ||
        oa.color !== ob.color ||
        oa.region.x !== ob.region.x ||
        oa.region.y !== ob.region.y ||
        oa.region.width !== ob.region.width ||
        oa.region.height !== ob.region.height
      ) {
        return false;
      }
    }
    return true;
  }

  // 监听原图 URL 和叠加层变化，自动重新合成
  watch(
    [imageUrl, overlays],
    ([newImageUrl, newOverlays], oldVal) => {
      const oldImageUrl = oldVal?.[0] as string | undefined;
      const oldOverlays = oldVal?.[1] as CharacterOverlayConfig[] | undefined;
      // 首次执行（无旧值）直接合成
      if (!oldVal) {
        composeImage();
        return;
      }
      // 图片 URL 变化必须重新合成
      if (newImageUrl !== oldImageUrl) {
        composeImage();
        return;
      }
      // overlays 内容真正变化时才重新合成
      if (oldOverlays && isOverlaysEqual(oldOverlays, newOverlays)) {
        return;
      }
      composeImage();
    },
    { immediate: true },
  );

  // 组件卸载时清理 blob URL
  onUnmounted(() => {
    if (previousBlobUrl) {
      URL.revokeObjectURL(previousBlobUrl);
    }
  });

  return {
    composedImageUrl,
    isComposing,
    composeError,
    recompose: composeImage,
  };
}