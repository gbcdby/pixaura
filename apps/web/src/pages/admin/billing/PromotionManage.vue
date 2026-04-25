<template>
  <div class="promotion-manage-page">
    <n-h2>充值活动管理</n-h2>

    <n-card>
      <n-space class="toolbar">
        <n-button
          type="primary"
          @click="showCreateModal = true"
        >
          创建活动
        </n-button>
      </n-space>

      <n-table
        :data="adminBillingStore.promotions"
        :loading="adminBillingStore.loading"
        striped
      >
        <thead>
          <tr>
            <th>活动名称</th>
            <th>最低金额</th>
            <th>赠送类型</th>
            <th>赠送值</th>
            <th>上限</th>
            <th>状态</th>
            <th>有效期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="promo in adminBillingStore.promotions"
            :key="promo.id"
          >
            <td>{{ promo.name }}</td>
            <td>¥{{ promo.minAmount }}</td>
            <td>{{ promo.bonusType === "percent" ? "百分比" : "固定值" }}</td>
            <td>
              {{ promo.bonusValue
              }}{{ promo.bonusType === "percent" ? "%" : "元" }}
            </td>
            <td>{{ promo.maxBonus ? `¥${promo.maxBonus}` : "无限制" }}</td>
            <td>
              <n-switch
                v-model:value="promo.isActive"
                @update:value="(val: boolean) => handleToggleStatus(promo, val)"
              />
            </td>
            <td>
              <span v-if="promo.startAt && promo.endAt">
                {{ formatDate(promo.startAt) }} 至 {{ formatDate(promo.endAt) }}
              </span>
              <span v-else>长期有效</span>
            </td>
            <td>
              <n-button
                text
                type="primary"
                @click="handleEdit(promo)"
              >
                编辑
              </n-button>
            </td>
          </tr>
        </tbody>
      </n-table>

      <n-empty
        v-if="!adminBillingStore.promotions.length"
        description="暂无充值活动"
      />
    </n-card>

    <!-- 创建/编辑对话框 -->
    <n-modal
      v-model:show="modalVisible"
      :title="isEditing ? '编辑活动' : '创建活动'"
      preset="card"
      style="width: 720px"
    >
      <n-form :model="form">
        <n-form-item
          label="活动名称"
          required
        >
          <n-input
            v-model:value="form.name"
            placeholder="例如：充值满100送10"
          />
        </n-form-item>
        <n-form-item label="活动描述">
          <n-input
            v-model:value="form.description"
            type="textarea"
            placeholder="输入活动描述，可选"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </n-form-item>

        <n-divider style="margin: 16px 0" />
        <div class="form-row">
          <n-form-item
            label="最低充值金额"
            required
            class="form-col"
          >
            <n-input-number
              v-model:value="form.minAmount"
              :min="1"
              style="width: 100%"
              placeholder="输入最低充值金额"
            >
              <template #prefix>
                ¥
              </template>
            </n-input-number>
          </n-form-item>
          <n-form-item
            label="赠送类型"
            required
            class="form-col"
          >
            <n-radio-group v-model:value="form.bonusType">
              <n-space>
                <n-radio value="percent">
                  百分比赠送
                </n-radio>
                <n-radio value="fixed">
                  固定金额赠送
                </n-radio>
              </n-space>
            </n-radio-group>
          </n-form-item>
        </div>

        <div class="form-row">
          <n-form-item
            :label="form.bonusType === 'percent' ? '赠送百分比' : '赠送金额'"
            required
            class="form-col"
          >
            <n-input-number
              v-model:value="form.bonusValue"
              :min="0"
              style="width: 100%"
              :placeholder="form.bonusType === 'percent' ? '例如 10 表示赠送 10%' : '输入固定赠送金额'"
            >
              <template #prefix>
                {{ form.bonusType === "percent" ? "" : "¥" }}
              </template>
              <template #suffix>
                {{ form.bonusType === "percent" ? "%" : "" }}
              </template>
            </n-input-number>
          </n-form-item>
          <n-form-item
            v-if="form.bonusType === 'percent'"
            label="赠送上限"
            class="form-col"
          >
            <n-input-number
              v-model:value="form.maxBonus"
              :min="0"
              style="width: 100%"
              placeholder="不填则无上限"
              clearable
            >
              <template #prefix>
                点
              </template>
            </n-input-number>
          </n-form-item>
        </div>

        <n-form-item label="有效期">
          <n-date-picker
            v-model:value="dateRange"
            type="datetimerange"
            clearable
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="启用状态">
          <n-switch v-model:value="form.isActive" />
          <span class="switch-hint">{{ form.isActive ? "已启用" : "已禁用" }}</span>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="modalVisible = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="adminBillingStore.loading"
            @click="handleSubmit"
          >
            {{ isEditing ? "保存" : "创建" }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useMessage } from "naive-ui";
import { useAdminBillingStore } from "@/stores/billing";
import type { RechargePromotion } from "@/types/billing";

const adminBillingStore = useAdminBillingStore();
const message = useMessage();

const modalVisible = ref(false);
const isEditing = ref(false);
const editingId = ref<string | null>(null);
const dateRange = ref<[number, number] | null>(null);

const form = ref({
  name: "",
  description: "",
  minAmount: 100,
  bonusType: "percent" as "percent" | "fixed",
  bonusValue: 10,
  maxBonus: null as number | null,
  isActive: true,
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function handleEdit(promo: RechargePromotion) {
  isEditing.value = true;
  editingId.value = promo.id;
  // 后端返回的 decimal 字段是字符串，需要转为数字
  form.value = {
    name: promo.name,
    description: promo.description || "",
    minAmount: Number(promo.minAmount),
    bonusType: promo.bonusType,
    bonusValue: Number(promo.bonusValue),
    maxBonus: promo.maxBonus != null ? Number(promo.maxBonus) : null,
    isActive: promo.isActive,
  };
  if (promo.startAt && promo.endAt) {
    dateRange.value = [
      new Date(promo.startAt).getTime(),
      new Date(promo.endAt).getTime(),
    ];
  } else {
    dateRange.value = null;
  }
  modalVisible.value = true;
}

function resetForm() {
  form.value = {
    name: "",
    description: "",
    minAmount: 100,
    bonusType: "percent",
    bonusValue: 10,
    maxBonus: null,
    isActive: true,
  };
  dateRange.value = null;
  isEditing.value = false;
  editingId.value = null;
}

async function handleToggleStatus(promo: RechargePromotion, isActive: boolean) {
  const originalStatus = promo.isActive;
  promo.isActive = isActive;
  try {
    await adminBillingStore.updatePromotion(promo.id, { isActive });
    message.success("状态已更新");
  } catch {
    message.error("更新失败");
    promo.isActive = originalStatus;
  }
}

async function handleSubmit() {
  if (!form.value.name || !form.value.minAmount || !form.value.bonusValue) {
    message.error("请填写必填项");
    return;
  }

  const data = {
    ...form.value,
    maxBonus: form.value.maxBonus ?? undefined,
    startAt: dateRange.value
      ? new Date(dateRange.value[0]).toISOString()
      : undefined,
    endAt: dateRange.value
      ? new Date(dateRange.value[1]).toISOString()
      : undefined,
  };

  try {
    if (isEditing.value && editingId.value) {
      await adminBillingStore.updatePromotion(editingId.value, data);
      message.success("保存成功");
    } else {
      await adminBillingStore.createPromotion(data);
      message.success("创建成功");
    }
    modalVisible.value = false;
    resetForm();
  } catch {
    message.error("操作失败");
  }
}

const showCreateModal = computed({
  get: () => modalVisible.value && !isEditing.value,
  set: (val) => {
    if (val) {
      resetForm();
      modalVisible.value = true;
    }
  },
});

onMounted(() => {
  adminBillingStore.fetchPromotions();
});
</script>

<style scoped lang="scss">
.promotion-manage-page {
  padding: 24px;
}

.toolbar {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 16px;

  .form-col {
    flex: 1;
    margin-bottom: 0;
  }
}

.switch-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}
</style>
