<template>
  <section id="features" class="features-section">
    <div class="section-container">
      <!-- Header -->
      <div class="section-header">
        <h2 class="section-title">强大的创作工具集</h2>
        <p class="section-desc">从灵感到成片，Pixaura 提供全流程 AI 辅助，让创作变得简单而高效</p>
      </div>

      <!-- Feature Cards -->
      <div class="features-grid">
        <FeatureCard
          icon="CreateOutline"
          title="智能剧本生成"
          description="输入简单的故事梗概，AI 自动生成完整剧本，包含对白、场景描述与情绪标注，支持多种题材风格。"
        />
        <FeatureCard
          icon="ImageOutline"
          title="AI 分镜设计"
          description="自动将剧本转化为专业分镜脚本，智能推荐镜头语言、构图与光影效果，让视觉呈现更专业。"
        />
        <FeatureCard
          icon="VideocamOutline"
          title="一键视频合成"
          description="基于分镜自动生成视频素材，智能配音、配乐与剪辑，支持导出多种格式，直接发布到各大平台。"
        />
      </div>

      <!-- Workflow -->
      <div class="workflow-visual">
        <!-- 连接线 - 使用 CSS 实现 -->
        <div class="workflow-connector">
          <div class="connector-line"></div>
        </div>
        <div class="workflow-steps">
          <WorkflowStep :active="true" label="输入创意" />
          <WorkflowStep :active="false" label="生成剧本" />
          <WorkflowStep :active="false" label="素材拆解" />
          <WorkflowStep :active="false" label="设计分镜" />
          <WorkflowStep :active="false" label="导出成片" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import FeatureCard from "./FeatureCard.vue";
import WorkflowStep from "./WorkflowStep.vue";
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>