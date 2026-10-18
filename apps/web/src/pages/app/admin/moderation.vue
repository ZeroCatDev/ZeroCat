<template>
  <v-container fluid>
    <v-card class="mb-4" title="内容与用户治理" subtitle="用户限制独立记录；删除与公开隐藏分别管理。">
      <v-tabs v-model="tab"><v-tab v-if="canReadContent || canManageContent" value="content">内容审核 / 回收站</v-tab><v-tab v-if="canRestrict" value="users">用户限制</v-tab></v-tabs>
    </v-card>
    <template v-if="tab === 'users' && canRestrict">
      <v-card class="pa-4">
        <v-form class="d-flex ga-3 align-start" @submit.prevent="selectedUser = userId">
          <v-text-field v-model="userId" label="用户 ID" type="number" min="1" variant="outlined" />
          <v-btn type="submit" :disabled="!Number(userId)" class="mt-2" color="primary">查看限制</v-btn>
        </v-form>
        <UserRestrictions v-if="selectedUser" :key="selectedUser" :user-id="selectedUser" />
      </v-card>
    </template>
    <v-card v-else-if="canReadContent || canManageContent">
      <v-card-text v-if="canManageContent" class="pb-0">
        <div class="d-flex flex-wrap ga-3 align-start">
          <v-select v-model="actionKind" :items="kinds" label="内容类型" variant="outlined" style="max-width: 200px" />
          <v-text-field v-model="actionId" label="内容 ID" type="number" min="1" variant="outlined" style="max-width: 240px" />
          <ContentModerationAction v-if="Number(actionId) > 0" :kind="actionKind" :content-id="actionId" @changed="load" />
        </div>
      </v-card-text>
      <v-card-text v-if="canReadContent">
        <v-row>
          <v-col cols="12" sm="4"><v-select v-model="kind" :items="kinds" label="内容类型" hide-details variant="outlined" @update:model-value="reset" /></v-col>
          <v-col cols="12" sm="4"><v-select v-model="state" :items="states" label="状态" hide-details variant="outlined" @update:model-value="reset" /></v-col>
          <v-col cols="12" sm="4"><v-btn :loading="loading" prepend-icon="mdi-refresh" variant="tonal" @click="load">刷新</v-btn></v-col>
        </v-row>
        <v-alert v-if="error" class="mt-4" type="error" variant="tonal">{{ error }}</v-alert>
      </v-card-text>
      <v-data-table-server v-if="canReadContent" v-model:page="page" v-model:items-per-page="limit" :headers="headers" :items="items" :items-length="total" :loading="loading" :items-per-page-options="[10, 20, 50]" no-data-text="暂无符合条件的内容" @update:options="load">
        <template #item.content="{ item }"><div class="content-preview">{{ item.title || item.content || item.name || '无正文' }}</div><div class="text-caption">{{ item.author?.username || item.authorid || item.author_id || item.user_id }}</div></template>
        <template #item.deleted_at="{ item }">{{ formatDate(item.deleted_at || item.shadowbanned_at) }}</template>
        <template #item.reason="{ item }">{{ item.deletion_reason || item.deleted_reason || item.shadowban_reason || '未填写' }}</template>
        <template #item.actions="{ item }"><v-btn variant="text" size="small" @click="selected = item">查看</v-btn><ContentModerationAction :kind="kind" :content-id="item.id" @changed="load" /></template>
      </v-data-table-server>
    </v-card>
    <v-dialog :model-value="!!selected" max-width="800" @update:model-value="selected = null">
      <v-card v-if="selected" :title="`${kind === 'post' ? '帖子' : '项目'} #${selected.id}`">
        <v-card-text><h3 class="text-h6 mb-3">{{ selected.title || selected.name }}</h3><p class="review-content">{{ selected.content || selected.description || '无正文' }}</p><v-divider class="my-4" /><p class="text-body-2">治理原因：{{ selected.deletion_reason || selected.deleted_reason || selected.shadowban_reason || '未填写' }}</p></v-card-text>
        <v-card-actions><ContentModerationAction :kind="kind" :content-id="selected.id" @changed="selected = null; load()" /><v-spacer /><v-btn @click="selected = null">关闭</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
<script setup>
import { computed, ref } from 'vue';
import moderation, { errorMessage, formatDate } from '@/services/moderationService';
import { localuser } from '@/services/localAccount';
import UserRestrictions from '@/components/admin/UserRestrictions.vue';
import ContentModerationAction from '@/components/admin/ContentModerationAction.vue';
const canRestrict = computed(() => localuser.can('admin:restrictions:read') || localuser.can('admin:restrictions:manage'));
const canReadContent = computed(() => localuser.can('admin:hidden_content:read'));
const canManageContent = computed(() => localuser.can('admin:content:manage'));
const actionKind = ref('post'), actionId = ref('');
const tab = ref(canReadContent.value || canManageContent.value ? 'content' : 'users');
const userId = ref(''), selectedUser = ref(''), kind = ref('post'), state = ref('deleted'), page = ref(1), limit = ref(20);
const items = ref([]), total = ref(0), loading = ref(false), error = ref(''), selected = ref(null);
const kinds = [{ title: '帖子', value: 'post' }, { title: '项目', value: 'project' }];
const states = [{ title: '已删除', value: 'deleted' }, { title: '公开隐藏', value: 'shadowbanned' }];
const headers = [{ title: 'ID', key: 'id', sortable: false }, { title: '内容 / 作者', key: 'content', sortable: false }, { title: '治理时间', key: 'deleted_at', sortable: false }, { title: '原因', key: 'reason', sortable: false }, { title: '操作', key: 'actions', sortable: false }];
let generation = 0;
async function load() {
  if (!canReadContent.value) return;
  const request = ++generation; loading.value = true; error.value = '';
  try {
    const data = await moderation.content({ kind: kind.value, state: state.value, page: page.value, limit: limit.value });
    if (request !== generation) return;
    items.value = data.items || data.content || []; total.value = Number(data.total || 0);
  } catch (err) { if (request === generation) error.value = errorMessage(err); }
  finally { if (request === generation) loading.value = false; }
}
function reset() { page.value = 1; load(); }
</script>
<style scoped>
.content-preview { max-width: 440px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 100px; overflow: hidden; }
.review-content { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
