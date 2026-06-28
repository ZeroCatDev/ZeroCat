<template>
  <div>
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-1">
          <div class="text-subtitle-1">合作者</div>
          <v-spacer />
          <v-btn
            v-if="canManage"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-account-plus"
            :disabled="loading"
            @click="openInvite"
          >邀请合作者</v-btn>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          邀请其他用户协作本项目。被邀请者同意后获得对应角色，可随时被移除或自行退出。删除项目始终仅作者本人可操作。
        </div>

        <!-- 各角色权限说明 -->
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel elevation="0">
            <v-expansion-panel-title class="text-body-2">
              <v-icon icon="mdi-shield-key-outline" size="18" class="mr-2" />
              各角色对应的权限
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div v-for="role in ROLE_DEFINITIONS" :key="role.key" class="mb-3">
                <div class="d-flex align-center mb-1">
                  <v-chip :color="role.color" size="small" label class="mr-2">{{ role.label }}</v-chip>
                  <span class="text-caption text-medium-emphasis">{{ role.summary }}</span>
                </div>
                <ul class="pl-6 text-body-2 text-medium-emphasis">
                  <li v-for="cap in role.caps" :key="cap">{{ cap }}</li>
                </ul>
              </div>
              <v-divider class="my-2" />
              <div class="d-flex align-start text-body-2 text-medium-emphasis">
                <v-icon icon="mdi-crown-outline" size="16" class="mr-2 mt-1" />
                <span>{{ OWNER_NOTE }}</span>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-2" rounded />

        <!-- 在册合作者 -->
        <div class="text-subtitle-2 mb-1">合作者（{{ collaborators.length }}）</div>
        <v-list v-if="collaborators.length" lines="two" class="pa-0 bg-transparent">
          <v-list-item v-for="m in collaborators" :key="m.user_id" class="px-0">
            <template #prepend>
              <v-avatar size="36" color="surface-variant">
                <v-img v-if="m.user?.avatar" :src="avatarUrl(m.user.avatar)" />
                <v-icon v-else icon="mdi-account" />
              </v-avatar>
            </template>
            <v-list-item-title>
              {{ m.user?.display_name || m.user?.username || ('用户 ' + m.user_id) }}
              <v-chip v-if="m.user_id === currentUserId" size="x-small" label class="ml-1">我</v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>@{{ m.user?.username }}</v-list-item-subtitle>
            <template #append>
              <div class="d-flex align-center ga-1">
                <!-- 可管理：点击角色直接修改权限 -->
                <v-menu v-if="canManage && m.user_id !== currentUserId">
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      v-bind="menuProps"
                      :color="roleColor(m.role_key)"
                      variant="tonal"
                      size="small"
                      append-icon="mdi-menu-down"
                    >{{ roleLabel(m.role_key) }}</v-btn>
                  </template>
                  <v-list density="compact" min-width="260" lines="two">
                    <v-list-subheader>修改为</v-list-subheader>
                    <v-list-item
                      v-for="role in ROLE_DEFINITIONS"
                      :key="role.key"
                      :active="role.key === m.role_key"
                      @click="changeRole(m, role.key)"
                    >
                      <template #prepend>
                        <v-icon :icon="role.key === m.role_key ? 'mdi-check-circle' : 'mdi-circle-outline'" :color="role.key === m.role_key ? 'primary' : undefined" />
                      </template>
                      <v-list-item-title>{{ role.label }}</v-list-item-title>
                      <v-list-item-subtitle>{{ role.summary }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-menu>
                <!-- 不可管理：只读展示角色 -->
                <v-chip v-else :color="roleColor(m.role_key)" size="small" label>{{ roleLabel(m.role_key) }}</v-chip>

                <v-tooltip v-if="canManage && m.user_id !== currentUserId" text="移除合作者" location="top">
                  <template #activator="{ props: tipProps }">
                    <v-btn
                      v-bind="tipProps"
                      icon="mdi-account-remove-outline"
                      size="small"
                      variant="text"
                      color="error"
                      @click="removeMemberClick(m)"
                    />
                  </template>
                </v-tooltip>
              </div>
            </template>
          </v-list-item>
        </v-list>
        <div v-else-if="!loading" class="text-body-2 text-medium-emphasis mb-2">还没有合作者。</div>

        <!-- 待处理邀请 -->
        <template v-if="invitations.length">
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-1">待处理邀请（{{ invitations.length }}）</div>
          <v-list lines="two" class="pa-0 bg-transparent">
            <v-list-item v-for="inv in invitations" :key="inv.id" class="px-0">
              <template #prepend>
                <v-avatar size="36" color="surface-variant">
                  <v-img v-if="inv.invitee?.avatar" :src="avatarUrl(inv.invitee.avatar)" />
                  <v-icon v-else icon="mdi-email-outline" />
                </v-avatar>
              </template>
              <v-list-item-title>{{ inv.invitee?.display_name || inv.invitee?.username }}</v-list-item-title>
              <v-list-item-subtitle>
                @{{ inv.invitee?.username }} ·
                <v-chip :color="roleColor(inv.role_key)" size="x-small" label class="mx-1">{{ inv.role_label || roleLabel(inv.role_key) }}</v-chip>
                · 等待对方接受
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="canManage"
                  size="small"
                  variant="text"
                  color="error"
                  @click="cancel(inv)"
                >取消邀请</v-btn>
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>
    </v-card>

    <!-- 邀请对话框 -->
    <v-dialog v-model="inviteDialog" max-width="540">
      <v-card>
        <v-card-title>邀请合作者</v-card-title>
        <v-card-text>
          <UserSelector
            v-model="inviteForm.userId"
            label="搜索用户"
            placeholder="输入用户名搜索…"
            :exclude-ids="excludedUserIds"
            @select="onUserSelect"
          />

          <div class="text-subtitle-2 mt-4 mb-1">分配角色</div>
          <v-radio-group v-model="inviteForm.roleKey" hide-details density="comfortable">
            <v-radio v-for="role in ROLE_DEFINITIONS" :key="role.key" :value="role.key">
              <template #label>
                <div class="d-flex align-center">
                  <v-chip :color="role.color" size="small" label class="mr-2">{{ role.label }}</v-chip>
                  <span class="text-body-2 text-medium-emphasis">{{ role.summary }}</span>
                </div>
              </template>
            </v-radio>
          </v-radio-group>

          <v-sheet v-if="selectedRole" color="surface-variant" rounded class="pa-3 mt-2">
            <div class="text-caption text-medium-emphasis mb-1">「{{ selectedRole.label }}」可以：</div>
            <ul class="pl-5 text-body-2">
              <li v-for="cap in selectedRole.caps" :key="cap">{{ cap }}</li>
            </ul>
          </v-sheet>

          <v-textarea
            v-model="inviteForm.message"
            label="留言（可选）"
            rows="2"
            variant="outlined"
            class="mt-4"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="inviteDialog = false">取消</v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            :loading="inviting"
            :disabled="!inviteForm.userId || !inviteForm.roleKey"
            @click="submitInvite"
          >发送邀请</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, getCurrentInstance } from "vue";
import { localuser } from "@/services/localAccount";
import collaborationService from "@/services/collaborationService";
import UserSelector from "@/components/shared/UserSelector.vue";

const props = defineProps({
  projectId: { type: [Number, String], default: 0 },
  isAuthor: { type: Boolean, default: false },
});

const instance = getCurrentInstance();
const toast = instance?.proxy?.$toast;
const notify = (severity, summary, detail) => {
  if (toast?.add) toast.add({ severity, summary, detail, life: 3000 });
};

// 角色定义：与后端 rolePermissions.js 的协作角色一一对应，权限逐条写明。
const ROLE_DEFINITIONS = [
  {
    key: "project_viewer",
    label: "查看者",
    color: "blue-grey",
    summary: "只读访问",
    caps: ["查看私有项目内容、提交历史与分析数据"],
  },
  {
    key: "project_editor",
    label: "编辑者",
    color: "primary",
    summary: "可编辑内容",
    caps: [
      "查看者的全部权限",
      "保存文件、提交代码、创建分支",
      "修改标题、简介、标签、类型、封面与云变量设置",
    ],
  },
  {
    key: "project_manager",
    label: "管理员",
    color: "deep-orange",
    summary: "可管理项目与成员",
    caps: [
      "编辑者的全部权限",
      "更改项目可见性（公开 / 私密）",
      "邀请、移除合作者并调整其角色",
    ],
  },
];
const OWNER_NOTE = "项目作者拥有全部权限；删除项目始终只有作者本人可以执行，合作者无法删除项目。";

const ROLE_MAP = Object.fromEntries(ROLE_DEFINITIONS.map((r) => [r.key, r]));

const loading = ref(false);
const inviting = ref(false);
const inviteDialog = ref(false);
const collaborators = ref([]);
const invitations = ref([]);

const inviteForm = reactive({ userId: null, user: null, roleKey: "project_editor", message: "" });

const currentUserId = computed(() => Number(localuser.user.value?.id) || 0);

const canManage = computed(() => {
  if (props.isAuthor) return true;
  return collaborators.value.some(
    (m) => m.user_id === currentUserId.value && m.role_key === "project_manager"
  );
});

const selectedRole = computed(() => ROLE_MAP[inviteForm.roleKey] || null);

// 已是合作者 / 待邀请 / 自己，搜索时排除，避免重复邀请。
const excludedUserIds = computed(() => {
  const ids = new Set([currentUserId.value]);
  collaborators.value.forEach((m) => ids.add(Number(m.user_id)));
  invitations.value.forEach((inv) => inv.invitee?.id && ids.add(Number(inv.invitee.id)));
  return [...ids];
});

function roleLabel(key) {
  return ROLE_MAP[key]?.label || key;
}
function roleColor(key) {
  return ROLE_MAP[key]?.color || "default";
}
function avatarUrl(hash) {
  return localuser.getUserAvatar ? localuser.getUserAvatar(hash) : hash;
}

async function loadMembers() {
  if (!props.projectId) return;
  loading.value = true;
  try {
    const res = await collaborationService.getProjectMembers(props.projectId);
    const data = res?.data || {};
    collaborators.value = data.collaborators || [];
    invitations.value = data.invitations || [];
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "获取合作者列表失败");
  } finally {
    loading.value = false;
  }
}

function openInvite() {
  inviteForm.userId = null;
  inviteForm.user = null;
  inviteForm.roleKey = "project_editor";
  inviteForm.message = "";
  inviteDialog.value = true;
}

function onUserSelect(user) {
  inviteForm.user = user || null;
}

async function submitInvite() {
  if (!inviteForm.userId) return;
  inviting.value = true;
  try {
    await collaborationService.inviteCollaborator(props.projectId, {
      userId: inviteForm.userId,
      roleKey: inviteForm.roleKey,
      message: inviteForm.message.trim() || undefined,
    });
    notify("success", "成功", "邀请已发送");
    inviteDialog.value = false;
    await loadMembers();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "发送邀请失败");
  } finally {
    inviting.value = false;
  }
}

async function changeRole(member, roleKey) {
  if (!roleKey || roleKey === member.role_key) return;
  try {
    await collaborationService.updateMemberRole(props.projectId, member.user_id, roleKey);
    notify("success", "成功", `已将权限改为「${roleLabel(roleKey)}」`);
    await loadMembers();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "更新角色失败");
    await loadMembers();
  }
}

async function removeMemberClick(member) {
  try {
    await collaborationService.removeMember(props.projectId, member.user_id);
    notify("success", "成功", "已移除合作者");
    await loadMembers();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "移除失败");
  }
}

async function cancel(invitation) {
  try {
    await collaborationService.cancelInvitation(props.projectId, invitation.id);
    notify("success", "成功", "已取消邀请");
    await loadMembers();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "取消邀请失败");
  }
}

// projectId 在父页面异步获取后才赋值，用 watch（immediate）确保拿到后再加载。
watch(() => props.projectId, (val) => {
  if (val) loadMembers();
}, { immediate: true });
</script>
