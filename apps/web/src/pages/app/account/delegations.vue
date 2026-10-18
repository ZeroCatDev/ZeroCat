<template>
  <v-container>
    <v-card title="授权委托" subtitle="邀请他人代表你操作指定资源，不共享账号或更换登录身份。" class="mb-4">
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>
        <v-btn color="primary" prepend-icon="mdi-plus" :disabled="localuser.readonly" @click="createDialog = true">发出委托邀请</v-btn>
        <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="load">刷新</v-btn>
      </v-card-text>
      <v-tabs v-model="tab"><v-tab value="received">收到的邀请</v-tab><v-tab value="sent">发出的邀请</v-tab></v-tabs>
      <v-data-table :headers="headers" :items="visibleItems" :loading="loading" no-data-text="暂无委托邀请">
        <template #item.people="{ item }">{{ tab === 'received' ? person(item.grantor || item.grantor_id) : person(item.delegate || item.delegate_id) }}</template>
        <template #item.resource="{ item }">{{ item.target_type }} #{{ item.target_id }}<div class="text-caption">{{ item.reason }}</div></template>
        <template #item.scopes="{ item }"><div v-for="scope in item.scopes" :key="scope">{{ scope }}</div></template>
        <template #item.status="{ item }">{{ statusLabel(item) }}</template>
        <template #item.expires_at="{ item }">{{ formatDate(item.expires_at) }}</template>
        <template #item.actions="{ item }">
          <template v-if="tab === 'received' && item.status === 'pending'">
            <v-btn color="primary" variant="text" size="small" :disabled="!!busy || readonlyFor(item)" @click="respond(item, 'accept')">接受</v-btn>
            <v-btn variant="text" size="small" :disabled="!!busy" @click="respond(item, 'decline')">拒绝</v-btn>
          </template>
          <v-btn v-if="tab === 'received' && active(item) && supportsDialog(item)" variant="text" size="small" :disabled="!!busy" @click="openResource(item)">代表操作</v-btn>
          <v-btn v-if="['pending', 'accepted', 'active'].includes(item.status) && !item.revoked_at" color="error" variant="text" size="small" :disabled="!!busy" @click="respond(item, 'revoke')">撤销</v-btn>
        </template>
      </v-data-table>
    </v-card>
    <v-dialog v-model="createDialog" max-width="640" :persistent="!!busy">
      <v-card title="发出资源委托邀请">
        <v-card-text>
          <v-alert v-if="dialogError" type="error" variant="tonal" class="mb-4">{{ dialogError }}</v-alert>
          <v-text-field v-model="form.delegate_id" label="受托用户 ID" type="number" variant="outlined" />
          <v-select v-model="form.target_type" :items="resourceTypes" label="资源类型" variant="outlined" @update:model-value="form.scopes = []" />
          <v-text-field v-model="form.target_id" label="资源 ID" variant="outlined" />
          <v-select v-model="form.scopes" :items="scopeOptions" label="委托能力" multiple chips variant="outlined" />
          <v-text-field v-model="form.expires_at" label="到期时间（留空为不限期）" type="datetime-local" variant="outlined" />
          <v-textarea v-model="form.reason" label="委托说明" rows="2" variant="outlined" />
          <p class="text-body-2">受托人接受后生效。你必须持续拥有对应权限；双方均可撤销，不能再次转交委托或委托账号安全、管理员操作。博客的删除能力用于丢弃草稿，不会删除文章。</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn :disabled="!!busy" @click="createDialog = false">取消</v-btn><v-btn color="primary" :loading="busy === 'create'" :disabled="!validCreate || readonlyFor(form)" @click="create">发出邀请</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog :model-value="!!acting" max-width="700" :persistent="!!busy" @update:model-value="acting = null">
      <v-card v-if="acting" title="代表操作">
        <v-card-text>
          <v-alert class="mb-4" type="info" variant="tonal">你正代表 {{ person(acting.grantor || acting.grantor_id) }} 操作 {{ acting.target_type }} #{{ acting.target_id }}。当前登录账号仍为 {{ localuser.user.value.username }}，仅此对话框的资源请求使用委托。</v-alert>
          <v-alert v-if="actionReadonly" type="warning" variant="tonal" class="mb-4">当前分类处于只读状态，仍可读取资源和撤销委托。</v-alert>
          <v-alert v-if="dialogError" type="error" variant="tonal" class="mb-4">{{ dialogError }}</v-alert>
          <v-progress-linear v-if="resourceLoading" indeterminate />
          <template v-if="!resourceLoading">
            <template v-if="editable && canAct('update')">
              <p v-if="!resource" class="text-body-2 mb-3">未读取资源。填写需替换的字段，留空的字段会保留。</p>
              <template v-if="acting.target_type !== 'comment'">
                <v-text-field v-model="resourceForm.title" label="标题" variant="outlined" :disabled="!!busy || actionReadonly" />
                <v-textarea v-model="resourceForm.description" label="简介" variant="outlined" :disabled="!!busy || actionReadonly" />
              </template>
              <v-textarea v-if="['blog', 'comment'].includes(acting.target_type)" v-model="resourceForm.content" :label="acting.target_type === 'blog' ? '草稿正文（Markdown）' : '评论正文'" rows="8" variant="outlined" :disabled="!!busy || actionReadonly" />
              <v-btn color="primary" :loading="busy === 'update'" :disabled="!!busy || actionReadonly" @click="updateResource">{{ acting.target_type === 'blog' ? '代表保存草稿' : '代表保存' }}</v-btn>
              <template v-if="acting.target_type === 'blog'">
                <v-checkbox v-model="confirmPublish" label="确认将授权者当前已保存的草稿发布（请先保存本次修改）" hide-details :disabled="!!busy || actionReadonly" />
                <v-btn class="mt-3" variant="outlined" :loading="busy === 'publish'" :disabled="!confirmPublish || !!busy || actionReadonly" @click="publishDraft">代表发布已保存草稿</v-btn>
              </template>
            </template>
            <p v-else-if="resource" class="post-preview">{{ previewContent }}</p>
            <template v-if="acting.target_type === 'comment' && canAct('interact')">
              <v-divider class="my-4" />
              <v-btn variant="outlined" :disabled="!!busy || actionReadonly" @click="likeComment(true)">代表点赞</v-btn>
              <v-btn variant="text" :disabled="!!busy || actionReadonly" @click="likeComment(false)">代表取消点赞</v-btn>
            </template>
            <template v-if="canAct('delete')">
              <v-divider class="my-4" />
              <v-checkbox v-model="confirmDelete" :label="deleteConfirmation" hide-details :disabled="!!busy || actionReadonly" />
              <v-btn color="error" variant="outlined" class="mt-3" :disabled="!confirmDelete || !!busy || actionReadonly" @click="deleteResource">{{ deleteLabel }}</v-btn>
            </template>
          </template>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn :disabled="!!busy" @click="acting = null">退出代表操作</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import delegation from '@/services/delegationService';
import { localuser } from '@/services/localAccount';
import { errorMessage, expiration, formatDate } from '@/services/moderationService';
import { useSudoManager } from '@/composables/useSudoManager';
const sudoManager = useSudoManager();
const tab = ref('received'), items = ref([]), loading = ref(false), busy = ref(''), error = ref(''), success = ref('');
const createDialog = ref(false), dialogError = ref(''), acting = ref(null), resource = ref(null), resourceLoading = ref(false), confirmDelete = ref(false), confirmPublish = ref(false);
const form = ref({ delegate_id: '', target_type: 'project', target_id: '', scopes: [], expires_at: '', reason: '' });
const readonlyFor = item => localuser.isReadonly(({ project: 'projects', post: 'posts', comment: 'comments', list: 'lists', blog: 'blog' })[item?.target_type] || '*') || (item?.target_type === 'blog' && localuser.isReadonly('projects'));
const actionReadonly = computed(() => readonlyFor(acting.value));
const resourceForm = ref({ title: '', description: '', content: '' });
const editable = computed(() => ['project', 'list', 'blog', 'comment'].includes(acting.value?.target_type));
const resourceTypes = [{ title: '项目', value: 'project' }, { title: '帖子', value: 'post' }, { title: '评论', value: 'comment' }, { title: '列表', value: 'list' }, { title: '博客', value: 'blog' }];
const scopeOptions = computed(() => (form.value.target_type === 'post' ? ['read', 'delete'] : ['read', 'update', 'delete', ...(form.value.target_type === 'comment' ? ['interact'] : [])]).map(action => `${form.value.target_type}:${form.value.target_id || 'ID'}:${action}`));
watch(() => form.value.target_id, () => { form.value.scopes = []; });
const validCreate = computed(() => Number(form.value.delegate_id) > 0 && !!form.value.target_id.trim() && form.value.scopes.length > 0);
const visibleItems = computed(() => items.value.filter(item => String(tab.value === 'received' ? item.delegate_id : item.grantor_id) === String(localuser.user.value.id)));
const headers = [{ title: '对方', key: 'people' }, { title: '资源', key: 'resource' }, { title: '能力', key: 'scopes' }, { title: '状态', key: 'status' }, { title: '到期', key: 'expires_at' }, { title: '操作', key: 'actions', sortable: false }];
const person = value => typeof value === 'object' && value ? (value.display_name || value.username || `用户 #${value.id}`) : `用户 #${value}`;
const active = item => ['accepted', 'active'].includes(item.status) && !item.revoked_at && (!item.expires_at || new Date(item.expires_at) > new Date());
const supportsDialog = item => ['project', 'post', 'list', 'blog'].includes(item.target_type) || (item.target_type === 'comment' && /^\d+$/.test(item.target_id));
const statusLabel = item => item.revoked_at ? '已撤销' : item.expires_at && new Date(item.expires_at) <= new Date() ? '已过期' : ({ pending: '待接受', accepted: '已接受', active: '生效中', declined: '已拒绝', revoked: '已撤销' }[item.status] || item.status);
const canAct = action => acting.value?.scopes?.includes(`${acting.value.target_type}:${acting.value.target_id}:${action}`);
const previewContent = computed(() => {
  const data = resource.value;
  if (!data) return '';
  return data.post?.content || data.orig || data.content || data.draft?.content || data.article?.file?.source || data.description || data.title || '无正文';
});
const deleteLabel = computed(() => ({ blog: '代表丢弃草稿', list: '代表永久删除列表', comment: '代表永久删除此条评论' }[acting.value?.target_type] || '代表移入回收站'));
const deleteConfirmation = computed(() => ({ blog: '确认丢弃授权者的未发布草稿（不会删除文章，草稿不可恢复）', list: '确认永久删除授权者的列表（不会删除其中的项目）', comment: '确认永久删除此条评论（不会删除他人的回复）' }[acting.value?.target_type] || '确认代表授权者将此内容移入回收站'));
async function load() {
  loading.value = true; error.value = '';
  try { const data = await delegation.list(); items.value = Array.isArray(data) ? data : data.delegations || data.items || [...(data.received || []), ...(data.sent || [])]; }
  catch (err) { error.value = errorMessage(err); }
  finally { loading.value = false; }
}
async function create() {
  if (busy.value || !validCreate.value || readonlyFor(form.value)) return;
  busy.value = 'create'; dialogError.value = '';
  try { await delegation.create({ ...form.value, delegate_id: Number(form.value.delegate_id), expires_at: expiration(form.value.expires_at) }); createDialog.value = false; success.value = '委托邀请已发出'; tab.value = 'sent'; await load(); }
  catch (err) { dialogError.value = errorMessage(err); }
  finally { busy.value = ''; }
}
async function respond(item, action) {
  if (busy.value || (action === 'accept' && readonlyFor(item))) return;
  busy.value = `${action}-${item.id}`; error.value = ''; success.value = '';
  try { await delegation.respond(item.id, action); success.value = '委托状态已更新'; await load(); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = ''; }
}
async function openResource(item) {
  acting.value = item; resource.value = null; dialogError.value = ''; confirmDelete.value = false; confirmPublish.value = false; resourceLoading.value = true;
  resourceForm.value = { title: '', description: '', content: '' };
  if (!item.scopes?.includes(`${item.target_type}:${item.target_id}:read`)) { resourceLoading.value = false; return; }
  try {
    const data = await delegation.resource(item);
    if (acting.value?.id !== item.id) return;
    resource.value = data;
    const source = data.draft || data.article || data.project || data;
    resourceForm.value = { title: source.title || '', description: source.description || '', content: source.orig ?? source.content ?? source.file?.source ?? '' };
  }
  catch (err) { if (acting.value?.id === item.id) dialogError.value = errorMessage(err); }
  finally { if (acting.value?.id === item.id) resourceLoading.value = false; }
}
async function updateResource() {
  if (!canAct('update') || busy.value || actionReadonly.value) return;
  const type = acting.value.target_type;
  const data = type === 'comment' ? { comment: resourceForm.value.content }
    : { title: resourceForm.value.title, description: resourceForm.value.description, ...(type === 'blog' ? { content: resourceForm.value.content } : {}) };
  const fields = resource.value ? data : Object.fromEntries(Object.entries(data).filter(([, value]) => value.trim()));
  if (!Object.keys(fields).length) return;
  busy.value = 'update'; dialogError.value = '';
  try { await delegation.updateResource(acting.value, fields); success.value = type === 'blog' ? '已代表授权者保存草稿，尚未发布' : '已代表授权者保存'; confirmPublish.value = false; }
  catch (err) { dialogError.value = errorMessage(err); }
  finally { busy.value = ''; }
}
async function publishDraft() {
  if (!canAct('update') || !confirmPublish.value || busy.value || actionReadonly.value) return;
  busy.value = 'publish'; dialogError.value = '';
  try { await delegation.publishDraft(acting.value); success.value = '已代表授权者发布草稿'; acting.value = null; }
  catch (err) { dialogError.value = errorMessage(err); }
  finally { busy.value = ''; }
}
async function likeComment(like) {
  if (!canAct('interact') || busy.value || actionReadonly.value) return;
  busy.value = 'interact'; dialogError.value = '';
  try { await delegation.likeComment(acting.value, like); success.value = like ? '已代表点赞' : '已代表取消点赞'; }
  catch (err) { dialogError.value = errorMessage(err); }
  finally { busy.value = ''; }
}
async function deleteResource() {
  if (!canAct('delete') || !confirmDelete.value || busy.value || actionReadonly.value) return;
  busy.value = 'delete'; dialogError.value = '';
  try {
    const sudoToken = ['project', 'list'].includes(acting.value.target_type) ? await sudoManager.requireSudo({ title: '验证身份以代表删除资源', subtitle: '验证当前受托账号，委托关系仍由服务器实时核对。' }) : undefined;
    await delegation.deleteResource(acting.value, sudoToken); success.value = `${deleteLabel.value}成功`; acting.value = null;
  }
  catch (err) { if (!['cancel', 'cancelled'].includes(err?.type)) dialogError.value = errorMessage(err); }
  finally { busy.value = ''; }
}
onMounted(load);
</script>
<style scoped>.post-preview { white-space: pre-wrap; overflow-wrap: anywhere; }</style>
