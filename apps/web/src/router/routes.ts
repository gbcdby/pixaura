import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/pages/Home.vue"),
    meta: { title: "首页" },
  },
  // 认证相关路由 - 使用 AuthLayout
  {
    path: "/",
    component: () => import("@/layouts/AuthLayout.vue"),
    meta: { requiresGuest: true },
    children: [
      {
        path: "/login",
        name: "Login",
        component: () => import("@/pages/user/auth/Login.vue"),
        meta: { title: "登录" },
      },
      {
        path: "/register",
        name: "Register",
        component: () => import("@/pages/user/auth/Register.vue"),
        meta: { title: "注册" },
      },
      {
        path: "/forgot-password",
        name: "ForgotPassword",
        component: () => import("@/pages/user/auth/ForgotPassword.vue"),
        meta: { title: "忘记密码" },
      },
    ],
  },
  {
    path: "/auth/verify-email",
    name: "VerifyEmail",
    component: () => import("@/pages/user/auth/VerifyEmail.vue"),
    meta: { title: "邮箱验证" },
  },
  // 用户中心路由
  {
    path: "/user/profile",
    name: "UserProfile",
    component: () => import("@/pages/user/profile/Profile.vue"),
    meta: { title: "个人中心", requiresAuth: true },
  },
  {
    path: "/user/default-models",
    name: "UserDefaultModels",
    component: () => import("@/pages/user/profile/DefaultModels.vue"),
    meta: { title: "默认模型设置", requiresAuth: true },
  },
  // Billing 路由
  {
    path: "/billing",
    meta: { requiresAuth: true },
    children: [
      {
        path: "recharge/result",
        name: "BillingRechargeResult",
        component: () => import("@/pages/billing/RechargeResult.vue"),
        meta: { title: "充值结果" },
      },
      {
        path: "subscription",
        name: "BillingSubscription",
        component: () => import("@/pages/billing/SubscriptionPage.vue"),
        meta: { title: "订阅管理" },
      },
      {
        path: "history",
        name: "BillingHistory",
        component: () => import("@/pages/billing/HistoryPage.vue"),
        meta: { title: "消费记录" },
      },
    ],
  },
  // 项目管理路由
  {
    path: "/projects",
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "ProjectList",
        component: () => import("@/pages/projects/ProjectList.vue"),
        meta: { title: "项目列表" },
      },
      {
        path: "trash",
        name: "ProjectTrash",
        component: () => import("@/pages/projects/ProjectTrash.vue"),
        meta: { title: "回收站" },
      },
      // 模板管理路由
      {
        path: "templates",
        name: "TemplateList",
        component: () => import("@/pages/projects/templates/TemplateList.vue"),
        meta: { title: "项目模板" },
      },
      {
        path: "templates/:template_id",
        name: "TemplateDetail",
        component: () =>
          import("@/pages/projects/templates/TemplateDetail.vue"),
        meta: { title: "模板详情" },
      },
      {
        path: "templates/:template_id/create",
        name: "CreateFromTemplate",
        component: () =>
          import("@/pages/projects/templates/CreateFromTemplate.vue"),
        meta: { title: "从模板创建" },
      },
      {
        path: ":id",
        component: () => import("@/layouts/ProjectLayout.vue"),
        children: [
          {
            path: "",
            name: "ProjectDetail",
            component: () => import("@/pages/projects/ProjectDetail.vue"),
            meta: { title: "项目详情" },
          },
          {
            path: "settings",
            name: "ProjectSettings",
            component: () => import("@/pages/projects/ProjectSettings.vue"),
            meta: { title: "项目设置" },
          },
          {
            path: "collaborators",
            name: "ProjectCollaborators",
            component: () =>
              import("@/pages/projects/ProjectCollaborators.vue"),
            meta: { title: "协作者管理" },
          },
          {
            path: "save-as-template",
            name: "SaveAsTemplate",
            component: () => import("@/pages/projects/SaveAsTemplate.vue"),
            meta: { title: "保存为模板" },
          },
          // 剧本管理路由
          {
            path: "scripts",
            name: "ProjectScripts",
            component: () => import("@/pages/scripts/ScriptList.vue"),
            meta: { title: "剧本管理" },
          },
          {
            path: "scripts/new",
            name: "ScriptCreate",
            component: () => import("@/pages/scripts/ScriptCreate.vue"),
            meta: { title: "创建剧本" },
          },
          // 角色管理路由
          {
            path: "characters",
            name: "ProjectCharacters",
            component: () => import("@/pages/characters/CharacterList.vue"),
            meta: { title: "角色库" },
          },
          {
            path: "characters/new",
            name: "CharacterCreate",
            component: () => import("@/pages/characters/CharacterCreate.vue"),
            meta: { title: "创建角色" },
          },
          {
            path: "characters/:characterId",
            name: "CharacterDetail",
            component: () => import("@/pages/characters/CharacterDetail.vue"),
            meta: { title: "角色详情" },
          },
          {
            path: "characters/:characterId/edit",
            name: "CharacterEdit",
            component: () => import("@/pages/characters/CharacterEdit.vue"),
            meta: { title: "编辑角色" },
          },
          // 场景管理路由
          {
            path: "scenes",
            name: "ProjectScenes",
            component: () => import("@/pages/scenes/SceneList.vue"),
            meta: { title: "场景库" },
          },
          {
            path: "scenes/new",
            name: "SceneCreate",
            component: () => import("@/pages/scenes/SceneCreate.vue"),
            meta: { title: "创建场景" },
          },
          {
            path: "scenes/:sceneId",
            name: "SceneDetail",
            component: () => import("@/pages/scenes/SceneDetail.vue"),
            meta: { title: "场景详情" },
          },
          {
            path: "scenes/:sceneId/edit",
            name: "SceneEdit",
            component: () => import("@/pages/scenes/SceneEdit.vue"),
            meta: { title: "编辑场景" },
          },
          // 道具管理路由
          {
            path: "props",
            name: "ProjectProps",
            component: () => import("@/pages/props/PropList.vue"),
            meta: { title: "道具库" },
          },
          {
            path: "props/new",
            name: "PropCreate",
            component: () => import("@/pages/props/PropCreate.vue"),
            meta: { title: "创建道具" },
          },
          {
            path: "props/:propId",
            name: "PropDetail",
            component: () => import("@/pages/props/PropDetail.vue"),
            meta: { title: "道具详情" },
          },
          {
            path: "props/:propId/edit",
            name: "PropEdit",
            component: () => import("@/pages/props/PropEdit.vue"),
            meta: { title: "编辑道具" },
          },
          // 分镜管理路由
          {
            path: "storyboards",
            name: "ProjectStoryboards",
            component: () => import("@/pages/storyboards/StoryboardList.vue"),
            meta: { title: "分镜管理" },
          },
          // 视频生成路由
          {
            path: "shots/:shotId/video-gen",
            name: "ShotVideoGen",
            component: () => import("@/pages/video-gen/ShotVideoGenPage.vue"),
            meta: { title: "分镜视频生成" },
          },
          {
            path: "video-gen/tasks",
            name: "VideoGenTasks",
            component: () => import("@/pages/video-gen/VideoGenTasks.vue"),
            meta: { title: "视频生成任务" },
          },
          {
            path: "video-gen/batch",
            name: "BatchVideoGen",
            component: () => import("@/pages/video-gen/BatchVideoGenPage.vue"),
            meta: { title: "批量视频生成" },
          },
          // 音频生成路由
          {
            path: "audio-gen/tasks",
            name: "AudioGenTasks",
            component: () => import("@/pages/audio-gen/AudioGenTasks.vue"),
            meta: { title: "音频生成任务" },
          },
          {
            path: "audio-gen/tts",
            name: "TTSTask",
            component: () => import("@/pages/audio-gen/TTSTask.vue"),
            meta: { title: "TTS配音生成" },
          },
          {
            path: "audio-gen/master-mix",
            name: "MasterMix",
            component: () => import("@/pages/audio-gen/MasterMix.vue"),
            meta: { title: "全局混音" },
          },
          {
            path: "audio-gen/bgm",
            name: "BGMSelect",
            component: () => import("@/pages/audio-gen/BGMSelect.vue"),
            meta: { title: "BGM选择" },
          },
          // 图片生成路由
          {
            path: "image-gen",
            name: "ImageGenList",
            component: () =>
              import("@/modules/image-gen/views/ImageGenList.vue"),
            meta: { title: "图片生成" },
          },
          {
            path: "image-gen/generate",
            name: "ImageGeneration",
            component: () =>
              import("@/modules/image-gen/views/ImageGeneration.vue"),
            meta: { title: "图像生成" },
          },
          // 【已废弃】保留重定向用于向后兼容
          {
            path: "image-gen/text-to-image",
            redirect: (to) => ({
              path: `/projects/${to.params.id}/image-gen/generate`,
            }),
          },
          {
            path: "image-gen/image-to-image",
            redirect: (to) => ({
              path: `/projects/${to.params.id}/image-gen/generate`,
            }),
          },
          {
            path: "image-gen/batch",
            name: "BatchGeneration",
            component: () =>
              import("@/modules/image-gen/views/BatchGeneration.vue"),
            meta: { title: "批量生成" },
          },
          {
            path: "image-gen/:taskId",
            name: "ImageGenDetail",
            component: () =>
              import("@/modules/image-gen/views/ImageGenDetail.vue"),
            meta: { title: "生成详情" },
          },
          // 剧本编辑路由 - 使用 ProjectLayout
          {
            path: "scripts/:scriptId/edit",
            name: "ScriptEdit",
            component: () => import("@/pages/scripts/ScriptEdit.vue"),
            meta: { title: "编辑剧本", requiresAuth: true, hideSidebar: true },
          },
          // 兼容不带 /edit 的旧 URL
          {
            path: "scripts/:scriptId",
            redirect: (to) => `/projects/${to.params.id}/scripts/${to.params.scriptId}/edit`,
          },
        ],
      },
    ],
  },
  // AI 任务管理路由
  {
    path: "/ai/tasks",
    name: "AITaskList",
    component: () => import("@/pages/ai/AITaskList.vue"),
    meta: { title: "AI 任务管理", requiresAuth: true },
  },
  // Asset 素材库路由
  {
    path: "/assets",
    name: "AssetLibrary",
    component: () => import("@/pages/assets/AssetLibrary.vue"),
    meta: { title: "素材库", requiresAuth: true },
  },
  {
    path: "/assets/search",
    name: "AssetSearch",
    component: () => import("@/pages/assets/AssetSearch.vue"),
    meta: { title: "搜索资产", requiresAuth: true },
  },
  {
    path: "/assets/favorites",
    name: "AssetFavorites",
    component: () => import("@/pages/assets/AssetFavorites.vue"),
    meta: { title: "我的收藏", requiresAuth: true },
  },
  {
    path: "/assets/recent",
    name: "AssetRecent",
    component: () => import("@/pages/assets/AssetRecent.vue"),
    meta: { title: "最近使用", requiresAuth: true },
  },
  {
    path: "/assets/popular",
    name: "AssetPopular",
    component: () => import("@/pages/assets/AssetPopular.vue"),
    meta: { title: "热门资产", requiresAuth: true },
  },
  // 管理端路由
  {
    path: "/admin",
    component: () => import("@/layouts/AdminLayout.vue"),
    meta: { title: "管理后台", requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: "",
        redirect: "/admin/dashboard",
      },
      {
        path: "dashboard",
        name: "AdminDashboard",
        component: () => import("@/pages/admin/dashboard/Dashboard.vue"),
        meta: { title: "仪表盘" },
      },
      {
        path: "users",
        name: "AdminUsers",
        component: () => import("@/pages/admin/users/UserList.vue"),
        meta: { title: "用户管理" },
      },
      {
        path: "users/:id",
        name: "AdminUserDetail",
        component: () => import("@/pages/admin/users/UserDetail.vue"),
        meta: { title: "用户详情" },
      },
      {
        path: "billing/quota-config",
        name: "AdminQuotaConfig",
        component: () => import("@/pages/admin/billing/QuotaConfig.vue"),
        meta: { title: "额度配置" },
      },
      {
        path: "billing/subscriptions",
        name: "AdminSubscriptions",
        component: () => import("@/pages/admin/billing/SubscriptionManage.vue"),
        meta: { title: "订阅管理" },
      },
      {
        path: "billing/transactions",
        name: "AdminTransactions",
        component: () => import("@/pages/admin/billing/TransactionQuery.vue"),
        meta: { title: "流水查询" },
      },
      {
        path: "billing/promotions",
        name: "AdminPromotions",
        component: () => import("@/pages/admin/billing/PromotionManage.vue"),
        meta: { title: "充值活动" },
      },
      {
        path: "billing/pricing-config",
        name: "PricingConfig",
        component: () => import("@/pages/admin/billing/PricingConfig.vue"),
        meta: { title: "价格配置" },
      },
      {
        path: "billing/pricing-history",
        name: "PricingHistory",
        component: () => import("@/pages/admin/billing/PricingHistory.vue"),
        meta: { title: "价格历史" },
      },
      {
        path: "config",
        name: "AdminConfig",
        component: () => import("@/pages/admin/config/SystemConfig.vue"),
        meta: { title: "系统配置" },
      },
      {
        path: "logs",
        name: "AdminLogs",
        component: () => import("@/pages/admin/logs/OperationLogs.vue"),
        meta: { title: "操作日志" },
      },
      {
        path: "model-config/providers",
        name: "AdminProviders",
        component: () => import("@/pages/admin/model-config/ProviderList.vue"),
        meta: { title: "供应商管理" },
      },
      {
        path: "model-config/models",
        name: "AdminModels",
        component: () => import("@/pages/admin/model-config/ModelList.vue"),
        meta: { title: "模型管理" },
      },
      {
        path: "model-config/health",
        name: "AdminHealth",
        component: () => import("@/pages/admin/model-config/HealthMonitor.vue"),
        meta: { title: "健康监控" },
      },
      // TTS 管理路由
      {
        path: "tts/voices",
        name: "AdminTtsVoices",
        component: () => import("@/pages/admin/tts/VoiceManager.vue"),
        meta: { title: "音色管理" },
      },
      {
        path: "tts/templates",
        name: "AdminTtsTemplates",
        component: () =>
          import("@/pages/admin/tts/InstructionTemplateManager.vue"),
        meta: { title: "指令模板" },
      },
      {
        path: "tts/config",
        name: "AdminTtsConfig",
        component: () => import("@/pages/admin/tts/TtsApiConfig.vue"),
        meta: { title: "基础配置" },
      },
      {
        path: "lip-sync/config",
        name: "AdminLipSyncConfig",
        component: () => import("@/pages/admin/lip-sync/LipSyncApiConfig.vue"),
        meta: { title: "对口型配置" },
      },
      {
        path: "notices",
        name: "AdminNoticeList",
        component: () => import("@/pages/admin/notices/NoticeList.vue"),
        meta: { title: "系统公告管理" },
      },
      {
        path: "notices/create",
        name: "AdminNoticeCreate",
        component: () => import("@/pages/admin/notices/NoticeEdit.vue"),
        meta: { title: "创建公告" },
      },
      {
        path: "notices/:id/edit",
        name: "AdminNoticeEdit",
        component: () => import("@/pages/admin/notices/NoticeEdit.vue"),
        meta: { title: "编辑公告" },
      },
    ],
  },
];
