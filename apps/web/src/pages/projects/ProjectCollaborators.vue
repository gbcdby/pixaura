<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  NCard,
  NButton,
  NTable,
  NSpace,
  NAvatar,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NInput,
  NEmpty,
  NTabs,
  NTabPane,
  NPopconfirm,
  NAlert,
  NRadioGroup,
  NRadioButton,
  useDialog,
  useMessage,
} from "naive-ui";
import {
  Add,
  Trash,
  Link,
  Copy,
  SwapHorizontalOutline as Swap,
} from "@vicons/ionicons5";
import { useProjectStore } from "@/stores/project";
import type { FormRules, SelectOption } from "naive-ui";

const projectStore = useProjectStore();
const dialog = useDialog();
const message = useMessage();

// 当前项目
const project = computed(() => projectStore.currentProject);
const collaborators = computed(() => projectStore.collaborators);
const inviteLinks = computed(() => projectStore.inviteLinks);
const isOwner = computed(() => projectStore.isOwner);

// 加载数据
onMounted(async () => {
  if (project.value) {
    await Promise.all([
      projectStore.fetchCollaborators(project.value.id),
      projectStore.fetchInviteLinks(project.value.id),
    ]);
  }
});

// ==================== 邀请协作者 ====================
const inviteModalVisible = ref(false);
const inviteForm = ref<{
  userId: string;
  username: string;
  role: "editor" | "viewer";
}>({
  userId: "",
  username: "",
  role: "viewer",
});
const inviteFormRef = ref<InstanceType<typeof NForm>>();
const inviting = ref(false);
const inviteMode = ref<"userId" | "username">("username");

const inviteRules: FormRules = {
  userId: [
    {
      required: inviteMode.value === "userId",
      message: "请输入用户ID",
      trigger: "blur",
    },
  ],
  username: [
    {
      required: inviteMode.value === "username",
      message: "请输入用户名",
      trigger: "blur",
    },
  ],
  role: [{ required: true, message: "请选择角色", trigger: "change" }],
};

const roleOptions: SelectOption[] = [
  { label: "编辑者 - 可编辑项目内容", value: "editor" },
  { label: "查看者 - 仅可查看", value: "viewer" },
];

const openInviteModal = () => {
  inviteForm.value = { userId: "", username: "", role: "viewer" };
  inviteMode.value = "username";
  inviteModalVisible.value = true;
};

const handleInvite = async () => {
  try {
    await inviteFormRef.value?.validate();

    if (!project.value) return;

    inviting.value = true;
    await projectStore.inviteCollaborator(project.value.id, {
      username:
        inviteMode.value === "username" ? inviteForm.value.username : undefined,
      userId:
        inviteMode.value === "userId" ? inviteForm.value.userId : undefined,
      role: inviteForm.value.role,
    });

    message.success("邀请成功");
    inviteModalVisible.value = false;
    await projectStore.fetchCollaborators(project.value.id);
  } catch (error: any) {
    message.error(error.message || "邀请失败");
  } finally {
    inviting.value = false;
  }
};

// ==================== 修改角色 ====================
const handleRoleChange = async (
  userId: string,
  newRole: "editor" | "viewer",
) => {
  if (!project.value) return;

  try {
    await projectStore.updateCollaboratorRole(project.value.id, userId, {
      role: newRole,
    });
    message.success("角色已更新");
  } catch (error: any) {
    message.error(error.message || "更新失败");
    await projectStore.fetchCollaborators(project.value.id);
  }
};

// ==================== 移除协作者 ====================
const handleRemove = (userId: string, username: string) => {
  if (!project.value) return;

  dialog.warning({
    title: "确认移除",
    content: `确定要移除协作者 "${username}" 吗？`,
    positiveText: "移除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await projectStore.removeCollaborator(project.value!.id, userId);
        message.success("已移除");
      } catch (error: any) {
        message.error(error.message || "移除失败");
      }
    },
  });
};

// ==================== 邀请链接 ====================
const createLinkModalVisible = ref(false);
const linkForm = ref<{
  role: "editor" | "viewer";
  expireDays: number;
}>({
  role: "viewer",
  expireDays: 7,
});
const creatingLink = ref(false);

const expireOptions: SelectOption[] = [
  { label: "1天", value: 1 },
  { label: "3天", value: 3 },
  { label: "7天", value: 7 },
  { label: "30天", value: 30 },
];

const openCreateLinkModal = () => {
  linkForm.value = { role: "viewer", expireDays: 7 };
  createLinkModalVisible.value = true;
};

const handleCreateLink = async () => {
  if (!project.value) return;

  creatingLink.value = true;
  try {
    const result = await projectStore.createInviteLink(project.value.id, {
      role: linkForm.value.role,
      expireDays: linkForm.value.expireDays,
    });

    message.success("邀请链接已创建");
    createLinkModalVisible.value = false;
    await projectStore.fetchInviteLinks(project.value.id);

    // 复制链接到剪贴板
    const inviteUrl = `${window.location.origin}/projects/join?code=${result.inviteCode}`;
    await navigator.clipboard.writeText(inviteUrl);
    message.success("链接已复制到剪贴板");
  } catch (error: any) {
    message.error(error.message || "创建失败");
  } finally {
    creatingLink.value = false;
  }
};

// 撤销邀请链接
const handleRevokeLink = (inviteCode: string) => {
  if (!project.value) return;

  dialog.warning({
    title: "确认撤销",
    content: "撤销后该邀请链接将失效，是否继续？",
    positiveText: "撤销",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await projectStore.revokeInviteLink(project.value!.id, inviteCode);
        message.success("链接已撤销");
      } catch (error: any) {
        message.error(error.message || "撤销失败");
      }
    },
  });
};

// 复制链接
const copyLink = (inviteCode: string) => {
  const inviteUrl = `${window.location.origin}/projects/join?code=${inviteCode}`;
  navigator.clipboard.writeText(inviteUrl);
  message.success("链接已复制");
};

// ==================== 转让所有权 ====================
const transferModalVisible = ref(false);
const transferUserId = ref("");
const transferring = ref(false);

const openTransferModal = () => {
  transferUserId.value = "";
  transferModalVisible.value = true;
};

const handleTransfer = async () => {
  if (!project.value || !transferUserId.value) return;

  transferring.value = true;
  try {
    await projectStore.transferOwnership(project.value.id, {
      userId: transferUserId.value,
    });

    message.success("所有权已转让");
    transferModalVisible.value = false;
    await projectStore.fetchCollaborators(project.value.id);
  } catch (error: any) {
    message.error(error.message || "转让失败");
  } finally {
    transferring.value = false;
  }
};

// 角色选项（用于表格中的选择器）
const tableRoleOptions: SelectOption[] = [
  { label: "编辑者", value: "editor" },
  { label: "查看者", value: "viewer" },
];
</script>

<template>
  <div
    v-if="project"
    class="project-collaborators-page"
  >
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        协作者管理
      </h1>
      <p class="page-subtitle">
        管理项目成员和邀请链接
      </p>
    </div>

    <n-tabs
      type="line"
      class="tabs"
    >
      <!-- 协作者列表 -->
      <n-tab-pane
        name="members"
        tab="项目成员"
      >
        <n-card :bordered="false">
          <div
            v-if="isOwner"
            class="section-header"
          >
            <n-space>
              <n-button
                type="primary"
                @click="openInviteModal"
              >
                <template #icon>
                  <n-icon><Add /></n-icon>
                </template>
                邀请协作者
              </n-button>
              <n-button @click="openTransferModal">
                <template #icon>
                  <n-icon><Swap /></n-icon>
                </template>
                转让所有权
              </n-button>
            </n-space>
          </div>

          <n-empty
            v-if="collaborators.length === 0"
            description="暂无协作者"
          />

          <n-table
            v-else
            :bordered="false"
            :single-line="false"
          >
            <thead>
              <tr>
                <th>用户</th>
                <th>角色</th>
                <th>加入时间</th>
                <th v-if="isOwner">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="collaborator in collaborators"
                :key="collaborator.id"
              >
                <td>
                  <n-space align="center">
                    <n-avatar
                      round
                      :size="36"
                      :src="collaborator.avatar || undefined"
                      :fallback-src="
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=' +
                          collaborator.id
                      "
                    />
                    <span>{{ collaborator.username }}</span>
                    <n-tag
                      v-if="collaborator.id === project.owner.id"
                      type="warning"
                      size="small"
                    >
                      所有者
                    </n-tag>
                  </n-space>
                </td>
                <td>
                  <template v-if="isOwner && collaborator.role !== 'owner'">
                    <n-select
                      :value="collaborator.role"
                      :options="tableRoleOptions"
                      size="small"
                      style="width: 120px"
                      @update:value="
                        (val) =>
                          handleRoleChange(
                            collaborator.id,
                            val as 'editor' | 'viewer',
                          )
                      "
                    />
                  </template>
                  <n-tag
                    v-else
                    :type="
                      collaborator.role === 'owner'
                        ? 'warning'
                        : collaborator.role === 'editor'
                          ? 'info'
                          : 'default'
                    "
                  >
                    {{
                      collaborator.role === "owner"
                        ? "所有者"
                        : collaborator.role === "editor"
                          ? "编辑者"
                          : "查看者"
                    }}
                  </n-tag>
                </td>
                <td>{{ new Date(collaborator.joinedAt).toLocaleString() }}</td>
                <td v-if="isOwner">
                  <n-popconfirm
                    v-if="collaborator.role !== 'owner'"
                    @positive-click="
                      handleRemove(collaborator.id, collaborator.username)
                    "
                  >
                    <template #trigger>
                      <n-button
                        text
                        type="error"
                        size="small"
                      >
                        <template #icon>
                          <n-icon><Trash /></n-icon>
                        </template>
                        移除
                      </n-button>
                    </template>
                    确定要移除该协作者吗？
                  </n-popconfirm>
                </td>
              </tr>
            </tbody>
          </n-table>
        </n-card>
      </n-tab-pane>

      <!-- 邀请链接 -->
      <n-tab-pane
        v-if="isOwner"
        name="links"
        tab="邀请链接"
      >
        <n-card :bordered="false">
          <div class="section-header">
            <n-button
              type="primary"
              @click="openCreateLinkModal"
            >
              <template #icon>
                <n-icon><Link /></n-icon>
              </template>
              创建邀请链接
            </n-button>
          </div>

          <n-empty
            v-if="inviteLinks.length === 0"
            description="暂无邀请链接"
          />

          <n-table
            v-else
            :bordered="false"
            :single-line="false"
          >
            <thead>
              <tr>
                <th>角色</th>
                <th>使用次数</th>
                <th>过期时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="link in inviteLinks"
                :key="link.inviteCode"
              >
                <td>
                  <n-tag :type="link.role === 'editor' ? 'info' : 'default'">
                    {{ link.role === "editor" ? "编辑者" : "查看者" }}
                  </n-tag>
                </td>
                <td>{{ link.usedCount }} / {{ link.maxUses }}</td>
                <td>{{ new Date(link.expiresAt).toLocaleString() }}</td>
                <td>
                  <n-tag
                    v-if="link.revokedAt"
                    type="error"
                  >
                    已撤销
                  </n-tag>
                  <n-tag
                    v-else-if="new Date(link.expiresAt) < new Date()"
                    type="warning"
                  >
                    已过期
                  </n-tag>
                  <n-tag
                    v-else-if="link.usedCount >= link.maxUses"
                    type="warning"
                  >
                    已用完
                  </n-tag>
                  <n-tag
                    v-else
                    type="success"
                  >
                    有效
                  </n-tag>
                </td>
                <td>
                  <n-space>
                    <n-button
                      text
                      type="primary"
                      size="small"
                      @click="copyLink(link.inviteCode)"
                    >
                      <template #icon>
                        <n-icon><Copy /></n-icon>
                      </template>
                      复制
                    </n-button>
                    <n-button
                      v-if="
                        !link.revokedAt &&
                          new Date(link.expiresAt) > new Date() &&
                          link.usedCount < link.maxUses
                      "
                      text
                      type="error"
                      size="small"
                      @click="handleRevokeLink(link.inviteCode)"
                    >
                      <template #icon>
                        <n-icon><Trash /></n-icon>
                      </template>
                      撤销
                    </n-button>
                  </n-space>
                </td>
              </tr>
            </tbody>
          </n-table>
        </n-card>
      </n-tab-pane>
    </n-tabs>

    <!-- 邀请协作者弹窗 -->
    <n-modal
      v-model:show="inviteModalVisible"
      title="邀请协作者"
      preset="card"
      style="width: 480px"
    >
      <n-form
        ref="inviteFormRef"
        :model="inviteForm"
        :rules="inviteRules"
        label-placement="left"
        label-width="80"
      >
        <n-form-item label="邀请方式">
          <n-radio-group v-model:value="inviteMode">
            <n-radio-button value="username">
              用户名
            </n-radio-button>
            <n-radio-button value="userId">
              用户ID
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item
          v-if="inviteMode === 'username'"
          label="用户名"
          path="username"
        >
          <n-input
            v-model:value="inviteForm.username"
            placeholder="请输入用户名"
          />
        </n-form-item>
        <n-form-item
          v-else
          label="用户ID"
          path="userId"
        >
          <n-input
            v-model:value="inviteForm.userId"
            placeholder="请输入用户ID"
          />
        </n-form-item>
        <n-form-item
          label="角色"
          path="role"
        >
          <n-select
            v-model:value="inviteForm.role"
            :options="roleOptions"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="inviteModalVisible = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="inviting"
            @click="handleInvite"
          >
            邀请
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 创建邀请链接弹窗 -->
    <n-modal
      v-model:show="createLinkModalVisible"
      title="创建邀请链接"
      preset="card"
      style="width: 480px"
    >
      <n-form
        label-placement="left"
        label-width="80"
      >
        <n-form-item label="角色">
          <n-select
            v-model:value="linkForm.role"
            :options="roleOptions"
          />
        </n-form-item>
        <n-form-item label="有效期">
          <n-select
            v-model:value="linkForm.expireDays"
            :options="expireOptions"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="createLinkModalVisible = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="creatingLink"
            @click="handleCreateLink"
          >
            创建
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 转让所有权弹窗 -->
    <n-modal
      v-model:show="transferModalVisible"
      title="转让项目所有权"
      preset="card"
      style="width: 480px"
    >
      <n-alert
        type="warning"
        style="margin-bottom: 16px"
      >
        转让所有权后，您将变为编辑者，无法恢复为所有者。
      </n-alert>
      <n-form
        label-placement="left"
        label-width="80"
      >
        <n-form-item label="新所有者">
          <n-select
            v-model:value="transferUserId"
            :options="
              collaborators
                .filter((c) => c.role !== 'owner')
                .map((c) => ({ label: c.username, value: c.id }))
            "
            placeholder="选择新所有者"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="transferModalVisible = false">
            取消
          </n-button>
          <n-button
            type="warning"
            :loading="transferring"
            @click="handleTransfer"
          >
            确认转让
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.project-collaborators-page {
  padding: 16px 24px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px;
  }

  .page-subtitle {
    font-size: 14px;
    color: #666;
    margin: 0;
  }
}

.tabs {
  :deep(.n-tabs-nav) {
    margin-bottom: 16px;
  }
}

.section-header {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}
</style>
