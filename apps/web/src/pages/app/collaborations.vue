<template>
  <v-container class="collaborations-page">
    <h1 class="text-h5 mb-1">合作与邀请</h1>
    <div class="text-body-2 text-medium-emphasis mb-4">
      管理你收到的项目合作邀请，以及你正在参与协作的项目。
    </div>

    <!-- 我的合作邀请 -->
    <v-card class="mb-6">
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-email-outline" class="mr-2" size="20" />
        我的合作邀请
        <v-spacer />
        <v-btn icon="mdi-refresh" size="small" variant="text" :loading="loadingInvites" @click="loadInvitations" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-progress-linear v-if="loadingInvites" indeterminate color="primary" class="mb-2" />
        <template v-if="invitations.length">
          <v-list lines="three" class="pa-0">
            <v-list-item v-for="inv in invitations" :key="inv.id" class="px-0">
              <template #prepend>
                <v-avatar size="40" color="surface-variant">
                  <v-img v-if="inv.inviter?.avatar" :src="avatarUrl(inv.inviter.avatar)" />
                  <v-icon v-else icon="mdi-account" />
                </v-avatar>
              </template>
              <v-list-item-title>
                {{ inv.inviter?.display_name || inv.inviter?.username || "有人" }}
                邀请你参与《{{ inv.project?.title || inv.project?.name || ("项目 " + inv.project_id) }}》
              </v-list-item-title>
              <v-list-item-subtitle>
                角色：{{ inv.role_label }}
                <span v-if="inv.message"> · “{{ inv.message }}”</span>
              </v-list-item-subtitle>
              <template #append>
                <div class="d-flex ga-2">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    size="small"
                    :loading="actioning === inv.id"
                    @click="accept(inv)"
                  >接受</v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    :disabled="actioning === inv.id"
                    @click="decline(inv)"
                  >拒绝</v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
        </template>
        <div v-else-if="!loadingInvites" class="text-body-2 text-medium-emphasis py-2">
          暂无待处理的邀请。
        </div>
      </v-card-text>
    </v-card>

    <!-- 我参与的协作 -->
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-account-group-outline" class="mr-2" size="20" />
        我参与的协作
        <v-spacer />
        <v-btn icon="mdi-refresh" size="small" variant="text" :loading="loadingMemberships" @click="loadMemberships" />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-progress-linear v-if="loadingMemberships" indeterminate color="primary" class="mb-2" />
        <template v-if="memberships.length">
          <v-list lines="two" class="pa-0">
            <v-list-item
              v-for="m in memberships"
              :key="m.grant_id"
              :to="projectLink(m.project)"
              class="px-0"
            >
              <template #prepend>
                <v-avatar size="40" color="surface-variant">
                  <v-icon icon="mdi-folder-outline" />
                </v-avatar>
              </template>
              <v-list-item-title>{{ m.project?.title || m.project?.name || ("项目 " + m.project?.id) }}</v-list-item-title>
              <v-list-item-subtitle>
                作者：{{ m.project?.author?.display_name || m.project?.author?.username || "未知" }} · 我的角色：{{ m.role_label }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  :loading="actioning === ('leave-' + m.project?.id)"
                  @click.prevent="leave(m)"
                >退出</v-btn>
              </template>
            </v-list-item>
          </v-list>
        </template>
        <div v-else-if="!loadingMemberships" class="text-body-2 text-medium-emphasis py-2">
          你还没有参与任何项目协作。
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { localuser } from "@/services/localAccount";
import collaborationService from "@/services/collaborationService";

useHead({ title: "合作与邀请" });

const instance = getCurrentInstance();
const toast = instance?.proxy?.$toast;
const router = useRouter();
const notify = (severity, summary, detail) => {
  if (toast?.add) toast.add({ severity, summary, detail, life: 3000 });
};

const invitations = ref([]);
const memberships = ref([]);
const loadingInvites = ref(false);
const loadingMemberships = ref(false);
const actioning = ref(null);

function avatarUrl(hash) {
  return localuser.getUserAvatar ? localuser.getUserAvatar(hash) : hash;
}

function projectLink(project) {
  if (project?.author?.username && project?.name) {
    return `/${project.author.username}/${project.name}`;
  }
  return `/app/link/project?id=${project?.id}`;
}

async function loadInvitations() {
  loadingInvites.value = true;
  try {
    invitations.value = await collaborationService.getMyInvitations();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "获取邀请失败");
  } finally {
    loadingInvites.value = false;
  }
}

async function loadMemberships() {
  loadingMemberships.value = true;
  try {
    memberships.value = await collaborationService.getMyCollaborations();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "获取协作项目失败");
  } finally {
    loadingMemberships.value = false;
  }
}

async function accept(inv) {
  actioning.value = inv.id;
  try {
    await collaborationService.acceptInvitation(inv.id);
    notify("success", "成功", "已接受邀请");
    await Promise.all([loadInvitations(), loadMemberships()]);
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "接受邀请失败");
  } finally {
    actioning.value = null;
  }
}

async function decline(inv) {
  actioning.value = inv.id;
  try {
    await collaborationService.declineInvitation(inv.id);
    notify("info", "已拒绝", "已拒绝邀请");
    await loadInvitations();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "拒绝邀请失败");
  } finally {
    actioning.value = null;
  }
}

async function leave(m) {
  actioning.value = "leave-" + m.project?.id;
  try {
    await collaborationService.leaveProject(m.project?.id);
    notify("info", "已退出", "已退出该项目协作");
    await loadMemberships();
  } catch (error) {
    notify("error", "错误", error?.response?.data?.message || "退出协作失败");
  } finally {
    actioning.value = null;
  }
}

onMounted(() => {
  if (!localuser.isLogin.value) {
    router.push("/app/account/login");
    return;
  }
  loadInvitations();
  loadMemberships();
});
</script>
