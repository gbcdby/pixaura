<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NLayoutSider,
  NCard,
  NButton,
  NSpace,
  NTag,
  NDescriptions,
  NDescriptionsItem,
  NSpin,
  NEmpty,
  NDivider,
  NList,
  NListItem,
  NThing,
  NIcon,
  useMessage,
} from "naive-ui";
import { ArrowBack, CopyOutline, PersonOutline } from "@vicons/ionicons5";
import { useTemplateStore } from "@/stores/template";
import { useUserStore } from "@/stores/user";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const templateStore = useTemplateStore();
const userStore = useUserStore();

// 模板ID
const templateId = computed(() => route.params.template_id as string);

// 加载状态
const loading = computed(() => templateStore.loading);

// 当前模板
const template = computed(() => templateStore.currentTemplate);

// 是否可以删除
const canDelete = computed(() => {
  if (!template.value) return false;
  return (
    template.value.type === "user" &&
    template.value.creator?.id === userStore.profile?.id
  );
});

// 加载模板详情
const loadTemplateDetail = async () => {
  try {
    await templateStore.fetchTemplateDetail(templateId.value);
  } catch (error) {
    message.error("加载模板详情失败");
  }
};

// 返回
const handleBack = () => {
  router.push("/projects/templates");
};

// 使用模板创建项目
const handleUseTemplate = () => {
  router.push(`/projects/templates/${templateId.value}/create`);
};

// 删除模板
const handleDelete = async () => {
  // TODO: 实现删除确认对话框
  message.info("删除功能开发中");
};

onMounted(() => {
  loadTemplateDetail();
});
</script>

<template>
  <div class="template-detail-page">
    <n-layout class="main-layout">
      <!-- 顶部栏 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <n-space align="center">
            <n-button
              quaternary
              @click="handleBack"
            >
              <template #icon>
                <n-icon><ArrowBack /></n-icon>
              </template>
              返回
            </n-button>
            <h1 class="page-title">
              模板详情
            </h1>
          </n-space>
          <n-space>
            <n-button
              v-if="canDelete"
              type="error"
              ghost
              @click="handleDelete"
            >
              删除模板
            </n-button>
            <n-button
              type="primary"
              @click="handleUseTemplate"
            >
              <template #icon>
                <n-icon><CopyOutline /></n-icon>
              </template>
              使用此模板
            </n-button>
          </n-space>
        </div>
      </n-layout-header>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <n-empty
            v-if="!loading && !template"
            description="模板不存在或无法访问"
          />

          <template v-else-if="template">
            <n-layout
              has-sider
              class="detail-layout"
            >
              <!-- 左侧：模板信息 -->
              <n-layout-sider
                width="320"
                bordered
                class="info-sider"
              >
                <n-card :bordered="false">
                  <h2 class="template-name">
                    {{ template.name }}
                  </h2>
                  <p
                    v-if="template.description"
                    class="template-description"
                  >
                    {{ template.description }}
                  </p>

                  <!-- 标签 -->
                  <div
                    v-if="template.tags?.length"
                    class="template-tags"
                  >
                    <n-space wrap>
                      <n-tag
                        v-for="tag in template.tags"
                        :key="tag"
                        size="small"
                      >
                        {{ tag }}
                      </n-tag>
                    </n-space>
                  </div>

                  <n-divider />

                  <!-- 基本信息 -->
                  <n-descriptions
                    :column="1"
                    size="small"
                  >
                    <n-descriptions-item label="类型">
                      <n-tag
                        :type="
                          template.type === 'system' ? 'success' : 'default'
                        "
                        size="small"
                      >
                        {{ template.type === "system" ? "系统" : "我的" }}
                      </n-tag>
                    </n-descriptions-item>
                    <n-descriptions-item label="创建者">
                      <n-space
                        align="center"
                        size="small"
                      >
                        <n-icon><PersonOutline /></n-icon>
                        {{ template.creator?.username || "官方" }}
                      </n-space>
                    </n-descriptions-item>
                    <n-descriptions-item label="使用次数">
                      {{ template.usageCount }} 次
                    </n-descriptions-item>
                    <n-descriptions-item label="创建时间">
                      {{ new Date(template.createdAt).toLocaleDateString() }}
                    </n-descriptions-item>
                  </n-descriptions>
                </n-card>
              </n-layout-sider>

              <!-- 右侧：内容预览 -->
              <n-layout-content class="preview-content">
                <n-card
                  title="模板内容"
                  :bordered="false"
                >
                  <!-- 角色列表 -->
                  <div
                    v-if="template.content?.characters?.length"
                    class="content-section"
                  >
                    <h3 class="section-title">
                      角色设定 ({{ template.content.characters.length }})
                    </h3>
                    <n-list>
                      <n-list-item
                        v-for="char in template.content.characters"
                        :key="char.name"
                      >
                        <n-thing
                          :title="char.name"
                          :description="char.description"
                        >
                          <template #header-extra>
                            <n-tag
                              v-if="char.importance === 'protagonist'"
                              type="success"
                              size="small"
                            >
                              主角
                            </n-tag>
                            <n-tag
                              v-else-if="char.importance === 'supporting'"
                              type="warning"
                              size="small"
                            >
                              配角
                            </n-tag>
                            <n-tag
                              v-else
                              size="small"
                            >
                              龙套
                            </n-tag>
                          </template>
                          <template v-if="char.personality">
                            <p>性格：{{ char.personality }}</p>
                          </template>
                        </n-thing>
                      </n-list-item>
                    </n-list>
                  </div>

                  <n-divider v-if="template.content?.characters?.length" />

                  <!-- 场景列表 -->
                  <div
                    v-if="template.content?.scenes?.length"
                    class="content-section"
                  >
                    <h3 class="section-title">
                      场景设定 ({{ template.content.scenes.length }})
                    </h3>
                    <n-list>
                      <n-list-item
                        v-for="scene in template.content.scenes"
                        :key="scene.name"
                      >
                        <n-thing
                          :title="scene.name"
                          :description="scene.description"
                        >
                          <template v-if="scene.atmosphere">
                            <n-tag
                              size="small"
                              type="info"
                            >
                              {{ scene.atmosphere }}
                            </n-tag>
                          </template>
                        </n-thing>
                      </n-list-item>
                    </n-list>
                  </div>

                  <n-divider v-if="template.content?.scenes?.length" />

                  <!-- 剧本大纲 -->
                  <div
                    v-if="template.content?.scriptOutline"
                    class="content-section"
                  >
                    <h3 class="section-title">
                      剧本大纲
                    </h3>
                    <n-descriptions
                      :column="2"
                      size="small"
                    >
                      <n-descriptions-item
                        v-if="template.content.scriptOutline.title"
                        label="标题"
                      >
                        {{ template.content.scriptOutline.title }}
                      </n-descriptions-item>
                      <n-descriptions-item
                        v-if="template.content.scriptOutline.genre"
                        label="类型"
                      >
                        {{ template.content.scriptOutline.genre }}
                      </n-descriptions-item>
                      <n-descriptions-item
                        v-if="template.content.scriptOutline.tone"
                        label="基调"
                      >
                        {{ template.content.scriptOutline.tone }}
                      </n-descriptions-item>
                      <n-descriptions-item
                        v-if="template.content.scriptOutline.targetDuration"
                        label="预估时长"
                      >
                        {{ template.content.scriptOutline.targetDuration }} 分钟
                      </n-descriptions-item>
                    </n-descriptions>

                    <!-- 幕结构 -->
                    <div
                      v-if="template.content.scriptOutline.acts?.length"
                      class="acts-list"
                    >
                      <h4 class="acts-title">
                        共 {{ template.content.scriptOutline.acts.length }} 幕
                      </h4>
                      <n-list>
                        <n-list-item
                          v-for="act in template.content.scriptOutline.acts"
                          :key="act.number"
                        >
                          <n-thing
                            :title="`第${act.number}幕：${act.title}`"
                            :description="act.summary"
                          >
                            <template
                              v-if="act.scenes?.length"
                              #description
                            >
                              <p>{{ act.summary }}</p>
                              <p class="scene-count">
                                包含 {{ act.scenes.length }} 场戏
                              </p>
                            </template>
                          </n-thing>
                        </n-list-item>
                      </n-list>
                    </div>
                  </div>

                  <!-- 模型配置 -->
                  <n-divider v-if="template.modelConfigs" />
                  <div
                    v-if="template.modelConfigs"
                    class="content-section"
                  >
                    <h3 class="section-title">
                      模型配置
                    </h3>
                    <n-descriptions
                      :column="2"
                      size="small"
                    >
                      <n-descriptions-item
                        v-for="(value, key) in template.modelConfigs"
                        :key="key"
                        :label="key"
                      >
                        {{ value }}
                      </n-descriptions-item>
                    </n-descriptions>
                  </div>
                </n-card>
              </n-layout-content>
            </n-layout>
          </template>
        </n-spin>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.template-detail-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;
}

.header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
  }
}

.content {
  padding: 24px;
  background: #f5f7fa;
}

.detail-layout {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.info-sider {
  background: #fafafa;
  padding: 16px;
}

.template-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px;
}

.template-description {
  font-size: 14px;
  color: #666;
  margin: 0 0 16px;
  line-height: 1.6;
}

.template-tags {
  margin-bottom: 16px;
}

.preview-content {
  padding: 24px;
}

.content-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px;
}

.acts-list {
  margin-top: 16px;

  .acts-title {
    font-size: 14px;
    font-weight: 500;
    color: #666;
    margin: 0 0 12px;
  }
}

.scene-count {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
