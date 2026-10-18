<template>
  <v-container>
    <v-card title="我的回收站" subtitle="保留已删除的帖子和项目；恢复后仍按原有可见性与账号限制判断访问。">
      <v-tabs v-model="kind" @update:model-value="reset"><v-tab value="post">帖子</v-tab><v-tab value="project">项目</v-tab></v-tabs>
      <v-card-text>
        <v-alert v-if="error" class="mb-3" type="error" variant="tonal">{{ error }}</v-alert>
        <v-alert v-if="success" class="mb-3" type="success" variant="tonal">{{ success }}</v-alert>
        <p class="text-body-2 mb-3">管理员删除的内容需由审核人员恢复。恢复不会重新发送旧通知或重新同步历史内容。</p>
        <v-btn prepend-icon="mdi-refresh" variant="text" :loading="loading" @click="load">刷新</v-btn>
      </v-card-text>
      <v-data-table-server v-model:page="page" v-model:items-per-page="limit" :headers="headers" :items="items" :items-length="total" :loading="loading" :items-per-page-options="[10, 20, 50]" no-data-text="回收站为空" @update:options="load">
        <template #item.content="{ item }"><div class="recycle-content">{{ item.title || item.content || item.name || '无正文' }}</div></template>
        <template #item.deleted_at="{ item }">{{ formatDate(item.deleted_at) }}</template>
        <template #item.source="{ item }">{{ adminDeleted(item) ? '管理员删除' : '自行删除' }}</template>
        <template #item.actions="{ item }"><v-btn color="primary" variant="text" :disabled="!!busy || readonly(item) || adminDeleted(item)" :loading="busy === item.id" @click="restore(item)">恢复</v-btn></template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>
<script setup>
import { ref } from 'vue';
import moderation, { errorMessage, formatDate } from '@/services/moderationService';
import { localuser } from '@/services/localAccount';
const kind = ref('post'), page = ref(1), limit = ref(20), items = ref([]), total = ref(0), loading = ref(false), busy = ref(null), error = ref(''), success = ref('');
const headers = [{ title: 'ID', key: 'id', sortable: false }, { title: '内容', key: 'content', sortable: false }, { title: '删除时间', key: 'deleted_at', sortable: false }, { title: '删除来源', key: 'source', sortable: false }, { title: '操作', key: 'actions', sortable: false }];
const adminDeleted = item => item.can_restore === false || ['admin', 'administrative', 'moderator', 'moderation'].includes(item.deletion_source || item.deleted_source);
const readonly = item => localuser.isReadonly(kind.value === 'post' ? 'posts' : 'projects') || (kind.value === 'project' && item.type === 'article' && localuser.isReadonly('blog'));
let generation = 0;
async function load() {
  const request = ++generation; loading.value = true; error.value = '';
  try { const data = await moderation.deleted(kind.value, { page: page.value, limit: limit.value }); if (request !== generation) return; items.value = data.items || data.posts || data.projects || []; total.value = Number(data.total || items.value.length); }
  catch (err) { if (request === generation) error.value = errorMessage(err); }
  finally { if (request === generation) loading.value = false; }
}
function reset() { page.value = 1; success.value = ''; load(); }
async function restore(item) {
  if (busy.value || readonly(item) || adminDeleted(item)) return;
  busy.value = item.id; error.value = ''; success.value = '';
  try { await moderation.restore(kind.value, item.id); success.value = '内容已恢复'; await load(); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = null; }
}
</script>
<style scoped>.recycle-content { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 600px; max-height: 120px; overflow: auto; }</style>
