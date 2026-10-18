<template>
  <v-card class="mt-4">
    <v-card-title>用户例外与资源授权</v-card-title>
    <v-card-text>
      <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
      <v-progress-linear v-if="loading" indeterminate class="mb-3" />
      <v-form v-if="canManage" @submit.prevent="save">
        <v-select v-model="kind" :items="kinds" label="授权方式" variant="outlined" :disabled="busy" />
        <v-select v-if="kind === 'role'" v-model="form.role_key" :items="roles" item-title="name" item-value="key" label="资源角色" variant="outlined" :disabled="busy" />
        <v-row v-else>
          <v-col cols="12" sm="8"><v-text-field v-model="form.scope" label="权限 scope" placeholder="project:update" variant="outlined" :disabled="busy" /></v-col>
          <v-col cols="12" sm="4"><v-select v-model="form.effect" :items="effects" label="效果" variant="outlined" :disabled="busy" /></v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6"><v-select v-model="form.target_type" :items="targets" clearable label="资源类型（留空为全局例外）" variant="outlined" :disabled="busy" /></v-col>
          <v-col cols="12" sm="6"><v-text-field v-model="form.target_id" label="资源 ID" variant="outlined" :disabled="busy || !form.target_type" /></v-col>
        </v-row>
        <v-text-field v-model="form.expires_at" label="到期时间（留空为不限期）" type="datetime-local" variant="outlined" :disabled="busy" />
        <v-textarea v-model="form.reason" label="原因" rows="2" variant="outlined" :disabled="busy" />
        <v-btn type="submit" color="primary" :loading="busy" :disabled="!valid">添加{{ kind === 'role' ? '资源角色' : '用户例外' }}</v-btn>
      </v-form>
      <v-divider class="my-5" />
      <h3 class="text-subtitle-1 mb-3">直接权限</h3>
      <v-list v-if="permissions.length" lines="three">
        <v-list-item v-for="item in permissions" :key="item.id">
          <v-list-item-title :class="item.effect === 'deny' ? 'text-error' : ''">{{ item.effect === 'deny' ? '拒绝' : '允许' }} · {{ item.scope }}</v-list-item-title>
          <v-list-item-subtitle class="rule-detail">{{ targetLabel(item) }} · 到期 {{ formatDate(item.expires_at) }}<br />{{ item.reason }}</v-list-item-subtitle>
          <template #append><v-btn v-if="canManage" variant="text" color="error" size="small" :disabled="busy" @click="removePermission(item)">撤销</v-btn></template>
        </v-list-item>
      </v-list>
      <p v-else class="text-body-2 text-medium-emphasis">无直接权限</p>
      <h3 class="text-subtitle-1 mt-5 mb-3">资源角色</h3>
      <v-list v-if="assignments.length" lines="three">
        <v-list-item v-for="item in assignments" :key="item.id">
          <v-list-item-title>{{ item.role_key || item.role?.name }}</v-list-item-title>
          <v-list-item-subtitle class="rule-detail">{{ targetLabel(item) }} · 到期 {{ formatDate(item.expires_at) }}<br />{{ item.reason }}</v-list-item-subtitle>
          <template #append><v-btn v-if="canManage" variant="text" color="error" size="small" :disabled="busy" @click="removeRole(item)">撤销</v-btn></template>
        </v-list-item>
      </v-list>
      <p v-else class="text-body-2 text-medium-emphasis">无资源角色</p>
    </v-card-text>
  </v-card>
  <v-card class="mt-4" title="有效权限解释">
    <v-card-text>
      <p class="text-body-2 mb-3">输入资源与动作，查看允许或拒绝的来源，例如 project:123:update。</p>
      <v-form class="d-flex ga-2" @submit.prevent="explain">
        <v-text-field v-model="explainScope" label="待检查 scope" variant="outlined" />
        <v-btn type="submit" class="mt-2" :loading="explaining" :disabled="!explainScope.trim()">检查</v-btn>
      </v-form>
      <v-alert v-if="explanation" :type="explanation.allowed ? 'success' : 'warning'" variant="tonal" class="mb-3">{{ explanation.allowed ? '允许' : '拒绝' }} · {{ explanation.reason || explanation.message || explanation.code || '已计算有效策略' }}</v-alert>
      <v-list v-if="sources.length" density="compact">
        <v-list-item v-for="(source, index) in sources" :key="index" :title="sourceLabel(source)" />
      </v-list>
      <pre v-if="explanation" class="policy-explanation">{{ JSON.stringify(explanation, null, 2) }}</pre>
    </v-card-text>
  </v-card>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import axios from '@/axios/axios';
import { errorMessage, expiration, formatDate, payload } from '@/services/moderationService';
import { localuser } from '@/services/localAccount';
const canManage = computed(() => localuser.can('admin:permissions:manage') && !localuser.readonly && Number(props.userId) !== Number(localuser.user.value.id));
const props = defineProps({ userId: { type: [String, Number], required: true }, roles: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);
const permissions = ref([]), assignments = ref([]), kind = ref('permission'), loading = ref(false), busy = ref(false), error = ref('');
const form = ref({ scope: '', effect: 'allow', role_key: '', target_type: null, target_id: '', expires_at: '', reason: '' });
const explainScope = ref(''), explanation = ref(null), explaining = ref(false);
const kinds = [{ title: '用户直接 allow / deny', value: 'permission' }, { title: '指定资源的角色', value: 'role' }];
const effects = [{ title: '允许 allow', value: 'allow' }, { title: '拒绝 deny', value: 'deny' }];
const targets = ['project', 'post', 'comment', 'list', 'blog'];
const valid = computed(() => (kind.value === 'role' ? !!form.value.role_key && !!form.value.target_type : !!form.value.scope.trim()) && (!form.value.target_type || !!form.value.target_id.trim()));
const sources = computed(() => explanation.value?.sources || explanation.value?.decision?.sources || []);
const targetLabel = item => item.target_type && item.target_type !== 'global' ? `${item.target_type} #${item.target_id}` : '全局';
const sourceLabel = source => typeof source === 'string' ? source : `${source.effect || source.type || '来源'} · ${source.scope || source.role_key || source.reason || JSON.stringify(source)}`;
let generation = 0;
async function load() {
  const request = ++generation; loading.value = true; error.value = '';
  try {
    const data = payload(await axios.get(`/admin/permissions/users/${props.userId}`));
    if (request !== generation) return;
    permissions.value = data.permissions || data.direct_permissions || [];
    assignments.value = (data.grants || data.assignments || []).filter(item => item.target_type && item.target_type !== 'global' && item.active !== false);
  } catch (err) { if (request === generation) error.value = errorMessage(err); }
  finally { if (request === generation) loading.value = false; }
}
async function save() {
  if (!valid.value || busy.value || !canManage.value) return;
  busy.value = true; error.value = '';
  try {
    const fields = { target_type: form.value.target_type || null, target_id: form.value.target_type ? form.value.target_id : null, expires_at: expiration(form.value.expires_at), reason: form.value.reason };
    if (kind.value === 'role') {
      await axios.post('/admin/permissions/grants', { ...fields, user_id: Number(props.userId), role_key: form.value.role_key });
    } else {
      await axios.post('/admin/permissions/grants', { ...fields, user_id: Number(props.userId), scope: form.value.scope.trim(), effect: form.value.effect });
    }
    form.value.scope = ''; form.value.reason = ''; await load(); emit('changed');
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function removePermission(item) {
  if (busy.value || !canManage.value) return;
  busy.value = true; error.value = '';
  try { await axios.delete(`/admin/permissions/grants/${item.id}`); await load(); emit('changed'); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function removeRole(item) {
  if (busy.value || !canManage.value) return;
  busy.value = true; error.value = '';
  try { await axios.delete(`/admin/permissions/grants/${item.id}`, { params: { type: 'role' } }); await load(); emit('changed'); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
async function explain() {
  explaining.value = true; error.value = ''; explanation.value = null;
  try { explanation.value = payload(await axios.get(`/admin/permissions/users/${props.userId}/explain`, { params: { scope: explainScope.value.trim() } })); }
  catch (err) { error.value = errorMessage(err); }
  finally { explaining.value = false; }
}
watch(() => props.userId, () => { explanation.value = null; load(); }, { immediate: true });
</script>
<style scoped>
.rule-detail { white-space: normal; overflow-wrap: anywhere; }
.policy-explanation { max-height: 300px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
</style>
