<template>
  <div>
    <div class="d-flex align-center ga-2 mb-4">
      <h3 class="text-subtitle-1">用户限制</h3><v-spacer />
      <v-btn v-if="canRead" :loading="loading" variant="text" prepend-icon="mdi-refresh" @click="load">刷新</v-btn>
    </div>
    <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
    <v-alert v-if="success" class="mb-4" type="success" variant="tonal">{{ success }}</v-alert>
    <p class="text-body-2 mb-4">只读限制写入；公开隐藏让本人仍可查看自己的内容。两种限制分别生效，撤销一条记录不会解除其他记录。</p>
    <v-form v-if="canRestrict" @submit.prevent="create">
      <v-select v-model="form.type" :items="types" label="限制类型" variant="outlined" :disabled="busy" />
      <v-select v-model="form.categories" :items="categories" multiple chips label="生效范围" variant="outlined" :disabled="busy" />
      <v-btn class="mb-4" variant="text" size="small" :disabled="busy" @click="form.categories = ['*']">全部公开数据（含未来新增类别）</v-btn>
      <v-textarea v-model="form.reason" label="管理原因" rows="2" variant="outlined" :disabled="busy" />
      <v-text-field v-model="form.expires_at" label="到期时间（留空为不限期）" type="datetime-local" variant="outlined" :disabled="busy" />
      <v-btn type="submit" color="primary" :loading="busy" :disabled="disabled || !canRestrict || !form.categories.length || !form.reason.trim()">添加限制</v-btn>
    </v-form>
    <v-divider class="my-5" />
    <h3 class="text-subtitle-1 mb-3">当前限制与历史</h3>
    <v-progress-linear v-if="loading" indeterminate />
    <v-list v-if="records.length" lines="three">
      <v-list-item v-for="item in records" :key="item.id">
        <v-list-item-title>{{ item.type === 'readonly' ? '只读' : '公开隐藏' }} · {{ active(item) ? '生效中' : '已结束' }}</v-list-item-title>
        <v-list-item-subtitle class="restriction-detail">范围：{{ (item.categories || []).map(categoryLabel).join('、') }}<br />{{ item.reason || '未填写原因' }}<br />创建 {{ formatDate(item.created_at) }} · 到期 {{ formatDate(item.expires_at) }}</v-list-item-subtitle>
        <template #append><v-btn v-if="active(item) && canRestrict" :disabled="busy || disabled" color="error" variant="text" @click="revoke(item)">撤销此条</v-btn></template>
      </v-list-item>
    </v-list>
    <p v-else-if="!loading" class="text-body-2 text-medium-emphasis">{{ canRead ? '暂无限制记录' : '当前账号没有查看限制历史的权限' }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import moderation, { errorMessage, expiration, formatDate } from '@/services/moderationService';
import { localuser } from '@/services/localAccount';

const props = defineProps({ userId: { type: [Number, String], required: true }, disabled: Boolean });
const emit = defineEmits(['changed']);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const success = ref('');
const records = ref([]);
const form = ref({ type: 'readonly', categories: ['*'], reason: '', expires_at: '' });
const types = [{ title: '只读', value: 'readonly' }, { title: '公开隐藏（shadowban）', value: 'shadowban' }];
const categories = [
  ['*', '全部公开数据'], ['profile', '个人主页'], ['posts', '帖子、回复与转发'], ['projects', '项目'],
  ['blog', '博客'], ['comments', '评论'], ['lists', '列表'], ['relations', '关系与公开互动'],
  ['activity', '动态'], ['assets', '素材'], ['extensions', '扩展'],
].map(([value, title]) => ({ value, title }));
const canRead = computed(() => localuser.can('admin:restrictions:read'));
const canRestrict = computed(() => localuser.can('admin:restrictions:manage') && !localuser.readonly);
const categoryLabel = value => categories.find(item => item.value === value)?.title || value;
const active = item => !item.revoked_at && item.active !== false && (!item.expires_at || new Date(item.expires_at).getTime() > Date.now());
let generation = 0;
async function load() {
  if (!canRead.value) return;
  const request = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const data = await moderation.restrictions(props.userId);
    if (request === generation) records.value = Array.isArray(data) ? data : data.restrictions || data.items || [];
  } catch (err) { if (request === generation) error.value = errorMessage(err); }
  finally { if (request === generation) loading.value = false; }
}
async function create() {
  if (busy.value || props.disabled || !canRestrict.value || !form.value.categories.length || !form.value.reason.trim()) return;
  busy.value = true; error.value = ''; success.value = '';
  try {
    await moderation.restrict(props.userId, { ...form.value, categories: form.value.categories.includes('*') ? ['*'] : form.value.categories, expires_at: expiration(form.value.expires_at) });
    form.value.reason = ''; success.value = '限制已添加'; await load(); emit('changed');
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function revoke(item) {
  if (busy.value || props.disabled || !canRestrict.value) return;
  busy.value = true; error.value = ''; success.value = '';
  try { await moderation.revokeRestriction(item.id); success.value = '此条限制已撤销'; await load(); emit('changed'); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
watch(() => props.userId, () => { success.value = ''; load(); }, { immediate: true });
</script>
<style scoped>
.restriction-detail { white-space: normal; overflow-wrap: anywhere; }
</style>
