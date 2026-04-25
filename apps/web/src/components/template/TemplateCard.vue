<template>
  <div
    class="template-card"
    @click="$emit('click')"
  >
    <div class="template-card__cover">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        :alt="template.name"
        class="template-card__image"
      >
      <div
        v-else
        class="template-card__placeholder"
      >
        <i class="icon-template" />
      </div>
      <div class="template-card__badge">
        <span
          :class="[
            'template-card__type',
            `template-card__type--${template.type}`,
          ]"
        >
          {{ typeLabel }}
        </span>
      </div>
    </div>

    <div class="template-card__content">
      <h3 class="template-card__name">
        {{ template.name }}
      </h3>
      <p
        v-if="template.description"
        class="template-card__description"
      >
        {{ template.description }}
      </p>

      <div class="template-card__meta">
        <span class="template-card__usage">
          <i class="icon-usage" />
          使用 {{ template.usageCount }} 次
        </span>
      </div>

      <div
        v-if="template.tags.length > 0"
        class="template-card__tags"
      >
        <span
          v-for="tag in template.tags.slice(0, 3)"
          :key="tag"
          class="template-card__tag"
        >
          {{ tag }}
        </span>
      </div>

      <div class="template-card__preview">
        <span class="preview-item">
          <i class="icon-character" />
          {{ template.preview.characterCount }} 角色
        </span>
        <span class="preview-item">
          <i class="icon-scene" />
          {{ template.preview.sceneCount }} 场景
        </span>
        <span class="preview-item">
          <i class="icon-act" />
          {{ template.preview.actCount }} 幕
        </span>
      </div>
    </div>

    <div class="template-card__actions">
      <button
        class="btn btn--primary btn--sm"
        @click.stop="$emit('use', template.id)"
      >
        使用此模板
      </button>
      <button
        v-if="canDelete"
        class="btn btn--danger btn--sm btn--icon"
        @click.stop="$emit('delete', template.id)"
      >
        <i class="icon-delete" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TemplateListItem } from "@/api/template";

interface Props {
  template: TemplateListItem;
  canDelete?: boolean;
  coverUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  canDelete: false,
  coverUrl: undefined,
});

defineEmits<{
  click: [];
  use: [templateId: string];
  delete: [templateId: string];
}>();

const typeLabel = computed(() => {
  return props.template.type === "system" ? "系统" : "我的";
});
</script>

<style scoped lang="scss">
.template-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  &__cover {
    position: relative;
    height: 160px;
    background: #f5f5f5;
  }

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    i {
      font-size: 48px;
      color: rgba(255, 255, 255, 0.8);
    }
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  &__type {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;

    &--system {
      background: #e3f2fd;
      color: #1976d2;
    }

    &--user {
      background: #f3e5f5;
      color: #7b1fa2;
    }
  }

  &__content {
    padding: 16px;
  }

  &__name {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    line-height: 1.4;
  }

  &__description {
    margin: 0 0 12px;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    margin-bottom: 12px;
  }

  &__usage {
    font-size: 12px;
    color: #999;

    i {
      margin-right: 4px;
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  &__tag {
    padding: 2px 8px;
    background: #f0f0f0;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
  }

  &__preview {
    display: flex;
    gap: 16px;
    padding-top: 12px;
    border-top: 1px solid #eee;

    .preview-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;

      i {
        color: #999;
      }
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #eee;

    .btn {
      flex: 1;

      &--icon {
        flex: 0 0 36px;
      }
    }
  }
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &--primary {
    background: #1976d2;
    color: #fff;

    &:hover {
      background: #1565c0;
    }
  }

  &--danger {
    background: #f5f5f5;
    color: #d32f2f;

    &:hover {
      background: #ffebee;
    }
  }

  &--sm {
    padding: 6px 12px;
    font-size: 13px;
  }
}
</style>
