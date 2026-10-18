<template>
  <v-btn v-if="canModerate" variant="text" size="small" prepend-icon="mdi-shield-edit-outline" @click.stop="open = true">管理内容</v-btn>
  <v-dialog v-model="open" max-width="560" :persistent="busy">
    <v-card title="内容治理">
      <v-card-text>
        <p class="mb-4">{{ kind === 'post' ? '帖子' : '项目' }} #{{ contentId }}</p>
        <v-alert v-if="error" class="mb-4" type="error" variant="tonal">{{ error }}</v-alert>
        <v-select v-model="action" :items="actions" variant="outlined" label="操作" :disabled="busy" />
        <p class="text-body-2 mb-4">{{ description }}</p>
        <v-textarea v-model="reason" label="管理原因" variant="outlined" rows="2" :disabled="busy" />
        <v-text-field v-if="action === 'hide'" v-model="expiresAt" label="隐藏到期时间（留空为不限期）" type="datetime-local" variant="outlined" :disabled="busy" />
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn :disabled="busy" @click="open = false">取消</v-btn><v-btn color="primary" :loading="busy" :disabled="!reason.trim() || !canSubmit" @click="submit">确认操作</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { localuser } from '@/services/localAccount';
import moderation, { errorMessage, expiration } from '@/services/moderationService';
import { showSnackbar } from '@/composables/useNotifications';
const props = defineProps({ kind: { type: String, required: true }, contentId: { type: [String, Number], required: true } });
const emit = defineEmits(['changed']);
const open = ref(false), busy = ref(false), error = ref(''), action = ref('hide'), reason = ref(''), expiresAt = ref('');
const canModerate = computed(() => localuser.can('admin:content:manage'));
const canSubmit = computed(() => !localuser.readonly && canModerate.value);

const actions = computed(() => [
  { title: '公开隐藏', value: 'hide' }, { title: '解除单项隐藏', value: 'unhide' },
  { title: '移入管理回收站', value: 'delete' }, { title: '恢复删除内容', value: 'restore' },
]);
watch(open, value => { if (value && !actions.value.some(item => item.value === action.value)) action.value = actions.value[0]?.value || 'hide'; });
const description = computed(() => ({ hide: '本人仍可查看；其他普通访问者无法查看。用户级隐藏限制会继续独立生效。', unhide: '只解除该内容的单项隐藏。用户限制和删除状态仍然生效。', delete: '保留内容和关联数据。管理员删除后仅审核人员可恢复。', restore: '解除删除状态后，仍按原有可见性及隐藏限制判断访问。' }[action.value]));
async function submit() {
  if (busy.value || !reason.value.trim() || !canSubmit.value) return;
  busy.value = true; error.value = '';
  try {
    await moderation.action(props.kind, props.contentId, ['hide', 'unhide'].includes(action.value) ? 'shadowban' : action.value,
      { reason: reason.value, ...(['hide', 'unhide'].includes(action.value) ? { hidden: action.value === 'hide', expires_at: expiration(expiresAt.value) } : {}) });
    showSnackbar('内容治理操作已完成', 'success'); open.value = false; reason.value = ''; emit('changed', action.value);
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
