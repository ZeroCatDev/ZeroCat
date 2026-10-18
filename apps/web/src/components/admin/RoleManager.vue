<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center">角色与继承<v-spacer /><v-btn v-if="canManage" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="edit()">新建角色</v-btn></v-card-title>
    <v-data-table :headers="headers" :items="roles" item-value="id" no-data-text="暂无角色">
      <template #item.parents="{ item }">{{ parentNames(item).join('、') || '无' }}</template>
      <template #item.permissions="{ item }">{{ item.permissions?.length || 0 }}</template>
      <template #item.actions="{ item }"><v-btn v-if="canManage" variant="text" size="small" @click="edit(item)">编辑</v-btn><v-btn v-if="canManage && !item.system" color="error" variant="text" size="small" @click="pendingDelete = item">删除</v-btn></template>
    </v-data-table>
    <v-alert v-if="error" class="ma-4" type="error" variant="tonal">{{ error }}</v-alert>
  </v-card>
  <v-dialog v-model="open" max-width="760" :persistent="busy" scrollable>
    <v-card :title="form.id ? '编辑角色' : '新建角色'">
      <v-card-text>
        <v-alert v-if="dialogError" class="mb-4" type="error" variant="tonal">{{ dialogError }}</v-alert>
        <v-text-field v-model="form.key" label="角色标识" hint="例如 content_reviewer" :disabled="!!form.id || busy" variant="outlined" />
        <v-text-field v-model="form.name" label="名称" variant="outlined" :disabled="busy" />
        <v-textarea v-model="form.description" label="说明" rows="2" variant="outlined" :disabled="busy" />
        <v-select v-model="form.parent_role_ids" :items="parentOptions" item-title="name" item-value="id" label="继承父角色" multiple chips variant="outlined" :disabled="busy" hint="角色可以继承多个父角色；服务端会拒绝循环继承。" persistent-hint />
        <h3 class="text-subtitle-1 mt-5 mb-3">角色权限</h3>
        <div v-for="(permission, index) in form.permissions" :key="index" class="d-flex align-start ga-2">
          <v-select v-model="permission.effect" :items="['allow', 'deny']" label="效果" variant="outlined" style="max-width: 135px" :disabled="busy" />
          <v-text-field v-model="permission.scope" label="权限 scope" placeholder="project:read" variant="outlined" :disabled="busy" />
          <v-btn aria-label="移除此权限" icon="mdi-close" variant="text" :disabled="busy" @click="form.permissions.splice(index, 1)" />
        </div>
        <v-btn variant="text" prepend-icon="mdi-plus" :disabled="busy" @click="form.permissions.push({ scope: '', effect: 'allow' })">添加权限</v-btn>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn :disabled="busy" @click="open = false">取消</v-btn><v-btn color="primary" :loading="busy" :disabled="!form.key.trim() || !form.name.trim()" @click="save">保存角色</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog :model-value="!!pendingDelete" max-width="480" :persistent="busy" @update:model-value="pendingDelete = null">
    <v-card title="删除角色"><v-card-text>删除「{{ pendingDelete?.name }}」及其授权关系。依赖此角色的用户将重新计算权限。</v-card-text><v-card-actions><v-spacer /><v-btn :disabled="busy" @click="pendingDelete = null">取消</v-btn><v-btn color="error" :loading="busy" @click="remove">删除角色</v-btn></v-card-actions></v-card>
  </v-dialog>
</template>
<script setup>
import { computed, ref } from 'vue';
import axios from '@/axios/axios';
import { errorMessage } from '@/services/moderationService';
import { localuser } from '@/services/localAccount';
const canManage = computed(() => localuser.can('admin:permissions:manage') && !localuser.readonly);
const props = defineProps({ roles: { type: Array, default: () => [] } });
const emit = defineEmits(['changed']);
const open = ref(false), busy = ref(false), error = ref(''), dialogError = ref(''), pendingDelete = ref(null);
const form = ref({ key: '', name: '', description: '', permissions: [], parent_role_ids: [] });
const headers = [{ title: '标识', key: 'key' }, { title: '名称', key: 'name' }, { title: '父角色', key: 'parents', sortable: false }, { title: '权限数量', key: 'permissions', sortable: false }, { title: '操作', key: 'actions', sortable: false }];
const parentIds = role => role.parent_role_ids || (role.parents || []).map(item => item.parent_role_id || item.parent?.id || item.id);
const parentOptions = computed(() => props.roles.filter(item => item.id !== form.value.id));
const parentNames = role => parentIds(role).map(id => props.roles.find(item => item.id === id)?.name || id);
function edit(role) {
  dialogError.value = '';
  form.value = role ? { id: role.id, key: role.key, name: role.name, description: role.description || '', permissions: (role.permissions || []).map(item => ({ scope: item.scope, effect: item.effect, ...(item.conditions ? { conditions: item.conditions } : {}) })), parent_role_ids: [...parentIds(role)] } : { key: '', name: '', description: '', permissions: [], parent_role_ids: [] };
  open.value = true;
}
async function save() {
  if (busy.value || !canManage.value || !form.value.key.trim() || !form.value.name.trim()) return;
  busy.value = true; dialogError.value = '';
  try {
    const body = { key: form.value.key.trim(), name: form.value.name.trim(), description: form.value.description, permissions: form.value.permissions.filter(item => item.scope.trim()).map(item => ({ scope: item.scope.trim(), effect: item.effect, ...(item.conditions ? { conditions: item.conditions } : {}) })), parent_role_ids: form.value.parent_role_ids };
    await (form.value.id ? axios.put(`/admin/permissions/roles/${form.value.id}`, body) : axios.post('/admin/permissions/roles', body));
    open.value = false; emit('changed');
  } catch (err) { dialogError.value = errorMessage(err); emit('changed'); }
  finally { busy.value = false; }
}
async function remove() {
  if (busy.value || !canManage.value || !pendingDelete.value) return;
  busy.value = true; error.value = '';
  try { await axios.delete(`/admin/permissions/roles/${pendingDelete.value.id}`); pendingDelete.value = null; emit('changed'); }
  catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
