<template>
  <div class="track-list">
    <div class="track-list-header">
      <span class="title">字幕轨道</span>
      <n-button
        size="small"
        quaternary
        @click="$emit('add')"
      >
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
      </n-button>
    </div>

    <div class="track-items">
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-item"
        :class="{ active: track.id === selectedTrackId }"
        @click="$emit('select', track.id)"
      >
        <div class="track-info">
          <n-icon
            class="track-icon"
            size="16"
          >
            <TextOutline />
          </n-icon>
          <span class="track-name">{{ track.name }}</span>
          <span class="track-count">({{ track.itemCount || 0 }})</span>
        </div>

        <div class="track-actions">
          <n-button
            size="tiny"
            quaternary
            :type="track.visible ? 'primary' : 'default'"
            @click.stop="$emit('toggle-visible', track.id, !track.visible)"
          >
            <template #icon>
              <n-icon>
                <EyeOutline v-if="track.visible" />
                <EyeOffOutline v-else />
              </n-icon>
            </template>
          </n-button>

          <n-popconfirm
            v-if="tracks.length > 1"
            @positive-click="$emit('delete', track.id)"
          >
            <template #trigger>
              <n-button
                size="tiny"
                quaternary
                @click.stop
              >
                <template #icon>
                  <n-icon><TrashOutline /></n-icon>
                </template>
              </n-button>
            </template>
            确定删除该轨道吗？
          </n-popconfirm>
        </div>
      </div>
    </div>

    <n-empty
      v-if="tracks.length === 0"
      description="暂无轨道"
      size="small"
    />
  </div>
</template>

<script setup lang="ts">
import {
  AddOutline,
  TextOutline,
  EyeOutline,
  EyeOffOutline,
  TrashOutline,
} from "@vicons/ionicons5";
import type { SubtitleTrackResponse } from "@pixaura/shared-types";

interface Props {
  tracks: SubtitleTrackResponse[];
  selectedTrackId: string | null;
}

defineProps<Props>();

defineEmits<{
  select: [trackId: string];
  "toggle-visible": [trackId: string, visible: boolean];
  delete: [trackId: string];
  add: [];
}>();
</script>

<style scoped>
.track-list {
  padding: 12px;
}

.track-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.track-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  background: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.track-item:hover {
  background: #444;
}

.track-item.active {
  background: #2080f0;
}

.track-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.track-icon {
  color: #888;
}

.track-item.active .track-icon {
  color: #fff;
}

.track-name {
  font-size: 13px;
  color: #fff;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-count {
  font-size: 12px;
  color: #888;
}

.track-item.active .track-count {
  color: rgba(255, 255, 255, 0.7);
}

.track-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.track-item:hover .track-actions,
.track-item.active .track-actions {
  opacity: 1;
}
</style>
