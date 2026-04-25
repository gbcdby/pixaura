<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { NButton, NSpace, NIcon, NAlert } from "naive-ui";
import {
  CheckmarkOutline,
  CloseOutline,
  RefreshOutline,
} from "@vicons/ionicons5";

/**
 * RegionSelectModal - 统一的基础框选弹窗组件
 * 支持两种模式：
 * - full: 完整功能（用于分镜组角色框选）
 * - simple: 简化功能（用于对话分镜图快速框选）
 */

interface Region {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** 是否显示弹窗 */
  show: boolean;
  /** 分镜主图 URL */
  imageUrl: string;
  /** 初始框选区域（用于编辑模式） */
  initialRegion?: Region;
  /** 角色名称（显示在标题中） */
  characterName?: string;
  /** 模式：full（完整）或 simple（简化） */
  mode?: "full" | "simple";
  /** 弹窗标题（simple 模式下使用） */
  title?: string;
  /** 弹窗宽度 */
  width?: string;
  /** 图片显示最大宽度 */
  maxWidth?: number;
  /** 图片显示最大高度 */
  maxHeight?: number;
  /** 宽高比（格式如 "16/9"），用于固定框选区域比例 */
  aspectRatio?: string;
}

const props = withDefaults(defineProps<Props>(), {
  characterName: "角色",
  mode: "simple",
  title: "框选角色区域",
  width: "400px",
  maxWidth: 320,
  maxHeight: 240,
});

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", region: Region, maskDataUrl: string): void;
  (e: "cancel"): void;
}>();

// 状态
const isLoading = ref(true);
const imageError = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

// 图片尺寸
const imageWidth = ref(0);
const imageHeight = ref(0);
const displayWidth = ref(0);
const displayHeight = ref(0);

// 框选状态
const isDrawing = ref(false);
const startPoint = ref({ x: 0, y: 0 });
const currentRegion = ref<Region | null>(null);
const hasRegion = computed(() => currentRegion.value !== null);

// 拖拽调整
const isDragging = ref(false);
const dragHandle = ref<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'move'

// 图片显示尺寸（动态计算，保持原始宽高比）
const computedImageStyle = computed(() => {
  // 约束：max-width: min(原始宽度, 90vw, 600px)，max-height: min(原始高度, 60vh, 500px)
  const maxAllowedWidth = Math.min(imageWidth.value, window.innerWidth * 0.9, 600);
  const maxAllowedHeight = Math.min(imageHeight.value, window.innerHeight * 0.6, 500);

  // 计算缩放比例，保持原始宽高比
  const scaleW = maxAllowedWidth / imageWidth.value;
  const scaleH = maxAllowedHeight / imageHeight.value;
  const scale = Math.min(scaleW, scaleH, 1); // 不放大，只缩小

  return {
    width: `${imageWidth.value * scale}px`,
    height: `${imageHeight.value * scale}px`,
  };
});

// 图片元素引用
const imageElement = ref<HTMLImageElement | null>(null);

// 计算弹窗标题
const modalTitle = computed(() => {
  if (props.mode === "full") {
    return `手动框选 - ${props.characterName}`;
  }
  return props.title;
});

// 加载图片
async function loadImage() {
  isLoading.value = true;
  imageError.value = false;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = props.imageUrl;
    });

    imageElement.value = img;
    imageWidth.value = img.naturalWidth;
    imageHeight.value = img.naturalHeight;

    // 计算显示尺寸（使用新的动态计算逻辑，保持原始宽高比）
    const style = computedImageStyle.value;
    displayWidth.value = parseInt(style.width);
    displayHeight.value = parseInt(style.height);

    // 初始化区域
    if (props.initialRegion) {
      currentRegion.value = { ...props.initialRegion };
    }

    isLoading.value = false;

    // 等待 DOM 更新后绘制
    await nextTick();
    drawCanvas();
  } catch {
    imageError.value = true;
    isLoading.value = false;
  }
}

// 绘制 Canvas
function drawCanvas() {
  const canvas = canvasRef.value;
  const img = imageElement.value;
  if (!canvas || !img) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 设置 canvas 尺寸
  canvas.width = displayWidth.value;
  canvas.height = displayHeight.value;

  // 绘制图片
  ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value);

  // 绘制框选区域
  if (currentRegion.value) {
    const region = currentRegion.value;
    const x = region.x * displayWidth.value;
    const y = region.y * displayHeight.value;
    const w = region.width * displayWidth.value;
    const h = region.height * displayHeight.value;

    // 绘制区域外遮罩（70% 透明度）
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    // 整个画布
    ctx.rect(0, 0, displayWidth.value, displayHeight.value);
    // 框选区域（使用 evenodd 规则实现挖空效果）
    ctx.rect(x, y, w, h);
    ctx.fill("evenodd");

    // 绘制边框
    ctx.strokeStyle = "#2080f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // 绘制调整手柄（full 模式下显示）
    if (props.mode === "full") {
      const handleSize = 8;
      ctx.fillStyle = "#2080f0";
      const handles = [
        { x: x - handleSize / 2, y: y - handleSize / 2 }, // 左上
        { x: x + w - handleSize / 2, y: y - handleSize / 2 }, // 右上
        { x: x - handleSize / 2, y: y + h - handleSize / 2 }, // 左下
        { x: x + w - handleSize / 2, y: y + h - handleSize / 2 }, // 右下
      ];
      handles.forEach((h) => {
        ctx.fillRect(h.x, h.y, handleSize, handleSize);
      });
    }
  }
}

// 获取鼠标在 canvas 上的位置
function getCanvasPosition(e: MouseEvent): { x: number; y: number } {
  const canvas = canvasRef.value;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// 检测点击位置（full 模式下启用）
function getHitHandle(x: number, y: number): string | null {
  if (props.mode !== "full" || !currentRegion.value) return null;

  const region = currentRegion.value;
  const rx = region.x * displayWidth.value;
  const ry = region.y * displayHeight.value;
  const rw = region.width * displayWidth.value;
  const rh = region.height * displayHeight.value;
  const handleSize = 12;

  // 检测手柄
  const handles = {
    tl: { x: rx, y: ry },
    tr: { x: rx + rw, y: ry },
    bl: { x: rx, y: ry + rh },
    br: { x: rx + rw, y: ry + rh },
  };

  for (const [key, pos] of Object.entries(handles)) {
    if (Math.abs(x - pos.x) < handleSize && Math.abs(y - pos.y) < handleSize) {
      return key;
    }
  }

  // 检测是否在区域内
  if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
    return "move";
  }

  return null;
}

// 鼠标按下
function handleMouseDown(e: MouseEvent) {
  const pos = getCanvasPosition(e);

  // full 模式下支持拖拽调整
  if (props.mode === "full" && currentRegion.value) {
    const handle = getHitHandle(pos.x, pos.y);
    if (handle) {
      isDragging.value = true;
      dragHandle.value = handle;
      startPoint.value = pos;
      return;
    }
  }

  // 开始新的绘制
  isDrawing.value = true;
  startPoint.value = pos;
  currentRegion.value = null;
}

// 鼠标移动
function handleMouseMove(e: MouseEvent) {
  const pos = getCanvasPosition(e);

  if (isDrawing.value) {
    // 固定起始点作为矩形的一个角，当前鼠标位置作为对角
    // 计算矩形的左上角坐标和宽高
    const startX = startPoint.value.x;
    const startY = startPoint.value.y;
    const currentX = pos.x;
    const currentY = pos.y;

    // 计算矩形区域（固定起始点，对角跟随鼠标）
    let x = Math.min(startX, currentX);
    let y = Math.min(startY, currentY);
    let w = Math.abs(currentX - startX);
    let h = Math.abs(currentY - startY);

    // 如果设置了宽高比，固定比例
    if (props.aspectRatio) {
      const [ratioW, ratioH] = props.aspectRatio.split('/').map(Number);
      if (ratioW && ratioH) {
        const targetRatio = ratioW / ratioH;
        const currentRatio = w / h;
        if (currentRatio > targetRatio) {
          // 宽度太大，以高度为基准调整宽度
          w = h * targetRatio;
          // 根据鼠标相对于起始点的位置，确定固定哪个角
          if (currentX < startX) {
            // 鼠标在起始点左侧，固定右侧
            x = startX - w;
          } else {
            // 鼠标在起始点右侧，固定左侧
            x = startX;
          }
        } else {
          // 高度太大，以宽度为基准调整高度
          h = w / targetRatio;
          if (currentY < startY) {
            // 鼠标在起始点上方，固定下侧
            y = startY - h;
          } else {
            // 鼠标在起始点下方，固定上侧
            y = startY;
          }
        }
      }
    }

    currentRegion.value = {
      x: x / displayWidth.value,
      y: y / displayHeight.value,
      width: w / displayWidth.value,
      height: h / displayHeight.value,
    };

    drawCanvas();
  } else if (isDragging.value && currentRegion.value && dragHandle.value) {
    // full 模式下拖拽调整区域
    const dx = (pos.x - startPoint.value.x) / displayWidth.value;
    const dy = (pos.y - startPoint.value.y) / displayHeight.value;

    const region = { ...currentRegion.value };

    if (dragHandle.value === "move") {
      // 移动整个区域（不改变大小）
      region.x = Math.max(0, Math.min(1 - region.width, region.x + dx));
      region.y = Math.max(0, Math.min(1 - region.height, region.y + dy));
    } else if (props.aspectRatio) {
      // 如果设置了宽高比，拖拽角落时保持宽高比
      const [ratioW, ratioH] = props.aspectRatio.split('/').map(Number);
      const targetRatio = ratioW / ratioH;
      // 显示区域的宽高比（用于正确计算）
      const displayRatio = displayWidth.value / displayHeight.value;
      // 目标宽高比在百分比坐标系中的值
      // 在像素坐标系中：pixelWidth / pixelHeight = targetRatio
      // 在百分比坐标系中：(width% * displayWidth) / (height% * displayHeight) = targetRatio
      // 所以：width% / height% = targetRatio / displayRatio
      const percentageRatio = targetRatio / displayRatio;

      if (dragHandle.value === "tl") {
        // 左上角：向左或向上拖拽，保持宽高比
        const newWidth = region.width - dx;
        const newHeight = newWidth / percentageRatio;
        const heightDiff = newHeight - region.height;
        region.x = Math.max(0, Math.min(region.x + region.width - 0.05, region.x + dx));
        region.y = Math.max(0, region.y + heightDiff);
        region.width = Math.max(0.05, newWidth);
        region.height = Math.max(0.05, newHeight);
      } else if (dragHandle.value === "tr") {
        // 右上角：向右或向上拖拽，保持宽高比
        const newWidth = region.width + dx;
        const newHeight = newWidth / percentageRatio;
        const heightDiff = newHeight - region.height;
        region.y = Math.max(0, region.y + heightDiff);
        region.width = Math.max(0.05, Math.min(1 - region.x, newWidth));
        region.height = Math.max(0.05, newHeight);
      } else if (dragHandle.value === "bl") {
        // 左下角：向左或向下拖拽，保持宽高比
        const newWidth = region.width - dx;
        const newHeight = newWidth / percentageRatio;
        region.x = Math.max(0, Math.min(region.x + region.width - 0.05, region.x + dx));
        region.width = Math.max(0.05, newWidth);
        region.height = Math.max(0.05, Math.min(1 - region.y, newHeight));
      } else if (dragHandle.value === "br") {
        // 右下角：向右或向下拖拽，保持宽高比
        const newWidth = Math.max(0.05, Math.min(1 - region.x, region.width + dx));
        const newHeight = newWidth / percentageRatio;
        region.width = newWidth;
        region.height = Math.max(0.05, Math.min(1 - region.y, newHeight));
      }
    } else {
      // 没有设置宽高比时，使用原来的自由调整逻辑
      if (dragHandle.value === "tl") {
        region.x = Math.max(
          0,
          Math.min(region.x + region.width - 0.05, region.x + dx),
        );
        region.y = Math.max(
          0,
          Math.min(region.y + region.height - 0.05, region.y + dy),
        );
        region.width = Math.max(0.05, region.width - dx);
        region.height = Math.max(0.05, region.height - dy);
      } else if (dragHandle.value === "tr") {
        region.y = Math.max(
          0,
          Math.min(region.y + region.height - 0.05, region.y + dy),
        );
        region.width = Math.max(0.05, Math.min(1 - region.x, region.width + dx));
        region.height = Math.max(0.05, region.height - dy);
      } else if (dragHandle.value === "bl") {
        region.x = Math.max(
          0,
          Math.min(region.x + region.width - 0.05, region.x + dx),
        );
        region.width = Math.max(0.05, region.width - dx);
        region.height = Math.max(
          0.05,
          Math.min(1 - region.y, region.height + dy),
        );
      } else if (dragHandle.value === "br") {
        region.width = Math.max(0.05, Math.min(1 - region.x, region.width + dx));
        region.height = Math.max(
          0.05,
          Math.min(1 - region.y, region.height + dy),
        );
      }
    }

    currentRegion.value = region;
    startPoint.value = pos;
    drawCanvas();
  }
}

// 鼠标释放
function handleMouseUp() {
  isDrawing.value = false;
  isDragging.value = false;
  dragHandle.value = null;
}

// 鼠标离开画布区域
function handleMouseLeave() {
  // 不立即取消绘制状态，允许用户移出后返回继续操作
  // 只有在真正释放鼠标时才结束绘制
}

// 鼠标进入画布区域
function handleMouseEnter() {
  // 如果鼠标已经进入但之前正在绘制，保持状态
}

// 生成 mask 图片
function generateMask(): string | null {
  if (!currentRegion.value || !imageElement.value) return null;

  const canvas = document.createElement("canvas");
  canvas.width = imageWidth.value;
  canvas.height = imageHeight.value;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 填充黑色背景
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, imageWidth.value, imageHeight.value);

  // 绘制白色区域
  const region = currentRegion.value;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(
    region.x * imageWidth.value,
    region.y * imageHeight.value,
    region.width * imageWidth.value,
    region.height * imageHeight.value,
  );

  return canvas.toDataURL("image/png");
}

// 确认
function handleConfirm() {
  if (!currentRegion.value) return;

  const maskDataUrl = generateMask();
  if (!maskDataUrl) return;

  emit("confirm", currentRegion.value, maskDataUrl);
  closeModal();
}

// 取消
function handleCancel() {
  emit("cancel");
  closeModal();
}

// 重置
function handleReset() {
  currentRegion.value = null;
  drawCanvas();
}

// 关闭弹窗
function closeModal() {
  emit("update:show", false);
}

// 监听显示状态
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      loadImage();
    } else {
      // 重置状态
      currentRegion.value = null;
      isLoading.value = true;
      imageError.value = false;
    }
  },
  { immediate: true },
);

// 键盘事件
function handleKeydown(e: KeyboardEvent) {
  if (!props.show) return;

  if (e.key === "Escape") {
    handleCancel();
  } else if (e.key === "Enter" && hasRegion.value) {
    handleConfirm();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("mouseup", handleGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("mouseup", handleGlobalMouseUp);
});

// 全局鼠标释放监听（处理鼠标移出画布后释放的情况）
function handleGlobalMouseUp() {
  isDrawing.value = false;
  isDragging.value = false;
  dragHandle.value = null;
}
</script>

<template>
  <div
    v-if="show"
    class="region-select-modal-overlay"
    @click.self="handleCancel"
  >
    <div
      class="region-select-modal"
      :style="{ width: width, maxWidth: '90vw' }"
    >
      <!-- 标题 -->
      <div class="modal-header">
        <span class="modal-title">{{ modalTitle }}</span>
        <n-button
          text
          size="small"
          @click="handleCancel"
        >
          <n-icon size="18">
            <CloseOutline />
          </n-icon>
        </n-button>
      </div>

      <!-- 内容区域 -->
      <div class="modal-content">
        <!-- 加载状态 -->
        <div
          v-if="isLoading"
          class="loading-state"
        >
          <span>加载图片中...</span>
        </div>

        <!-- 错误状态 -->
        <n-alert
          v-else-if="imageError"
          type="error"
          title="图片加载失败"
        >
          无法加载分镜主图，请检查图片链接是否有效。
        </n-alert>

        <!-- 编辑区域 -->
        <div
          v-else
          class="editor-area"
        >
          <div
            ref="containerRef"
            class="canvas-container"
            @mouseleave="handleMouseLeave"
            @mouseenter="handleMouseEnter"
          >
            <canvas
              ref="canvasRef"
              :width="displayWidth"
              :height="displayHeight"
              class="edit-canvas"
              @mousedown="handleMouseDown"
              @mousemove="handleMouseMove"
              @mouseup="handleMouseUp"
            />
          </div>

          <div class="editor-tips">
            <span>
              {{ mode === "full" ? "在图片上拖拽绘制框选区域，或拖动边角调整" : "在图片上拖拽绘制框选区域" }}
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="modal-actions">
          <!-- full 模式显示重置按钮 -->
          <n-space v-if="mode === 'full'">
            <n-button
              quaternary
              :disabled="!hasRegion"
              @click="handleReset"
            >
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
              重置
            </n-button>
          </n-space>
          <n-space v-else />

          <n-space>
            <n-button @click="handleCancel">
              <template #icon>
                <n-icon><CloseOutline /></n-icon>
              </template>
              取消
            </n-button>
            <n-button
              type="primary"
              :disabled="!hasRegion"
              @click="handleConfirm"
            >
              <template #icon>
                <n-icon><CheckmarkOutline /></n-icon>
              </template>
              确认
            </n-button>
          </n-space>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.region-select-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3000;
}

.region-select-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;

  .modal-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
}

.editor-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.canvas-container {
  display: flex;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.edit-canvas {
  cursor: crosshair;
  display: block;
  max-width: 100%;
}

.editor-tips {
  text-align: center;
  font-size: 12px;
  color: #999;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #e8e8e8;
}
</style>