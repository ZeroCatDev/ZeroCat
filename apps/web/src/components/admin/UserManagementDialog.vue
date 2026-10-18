<template>
  <v-dialog
    max-width="960"
    :model-value="modelValue"
    :persistent="!!busy"
    scrollable
    @update:model-value="close"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2 flex-wrap">
        <span>管理用户 · {{ target.username }}</span>
        <span class="text-body-2 text-medium-emphasis">#{{ user.id }}</span>
        <v-spacer />
        <v-btn
          aria-label="关闭用户管理"
          :disabled="!!busy"
          icon="mdi-close"
          variant="text"
          @click="close"
        />
      </v-card-title>
      <v-tabs v-model="tab" :disabled="!!busy || accountDeleted" show-arrows>
        <v-tab value="account">账号状态</v-tab>
        <v-tab v-if="localuser.can('admin:restrictions:read')" value="restrictions">用户限制</v-tab>
        <v-tab value="sessions">登录设备</v-tab>
        <v-tab value="data">数据管理</v-tab>
      </v-tabs>
      <v-divider />
      <v-card-text class="management-body">
        <v-progress-linear v-if="summaryLoading" aria-label="加载管理预览" class="mb-4" indeterminate />
        <v-alert v-if="summaryError" class="mb-4" type="error" variant="tonal">
          {{ summaryError }}
          <v-btn :disabled="!!busy || summaryLoading" variant="text" @click="loadSummary">重试预览</v-btn>
        </v-alert>
        <v-alert
          v-if="error"
          class="mb-4"
          role="alert"
          type="error"
          variant="tonal"
        >{{ error }}</v-alert>
        <v-alert
          v-if="result"
          class="mb-4"
          role="status"
          type="success"
          variant="tonal"
        >
          {{ result.message }}
          <ul v-if="resultCounts.length > 0" class="pl-5 mt-2">
            <li v-for="entry in resultCounts" :key="entry.key">{{ entry.label }}：{{ entry.count }}</li>
          </ul>
        </v-alert>
        <v-alert
          v-if="resultWarnings.length > 0"
          class="mb-4"
          role="status"
          type="warning"
          variant="tonal"
        >
          <ul class="pl-5"><li v-for="warning in resultWarnings" :key="warning">{{ warning }}</li></ul>
        </v-alert>
        <v-alert v-if="summary && !canManage && !summaryLoading && !summaryError && !accountDeleted" class="mb-4" type="info" variant="tonal">
          {{ protectionReason }}
        </v-alert>

        <v-window v-if="!accountDeleted" v-model="tab" :touch="false">
          <v-window-item value="account">
            <dl class="account-details mb-5">
              <dt>用户名</dt><dd>{{ target.username }}</dd>
              <dt>显示名称</dt><dd>{{ target.display_name || '未设置' }}</dd>
              <dt>用户类型</dt><dd>{{ isAdminType(target.type) ? '管理员' : (target.type === 'guest' ? '访客' : '普通用户') }}</dd>
              <dt>账号状态</dt><dd>{{ statusLabel(target.status) }}</dd>
            </dl>
            <h3 class="text-subtitle-1 mb-2">变更账号状态</h3>
            <p class="text-body-2 mb-4">
              封禁或暂停会立即撤销该用户所有类型的令牌，包括登录设备、个人 API、OAuth 和编辑器令牌。
              恢复活跃不会恢复旧令牌，用户需要重新登录或授权。状态变更不删除内容。
            </p>
            <v-select
              v-model="nextStatus"
              :disabled="!canManage || !!busy"
              :items="statusOptions"
              label="目标状态"
              variant="outlined"
            />
            <v-btn color="primary" :disabled="!canManage || !!busy || nextStatus === target.status" :loading="busy === 'status'" @click="askStatus">
              确认变更状态
            </v-btn>
          </v-window-item>

          <v-window-item value="restrictions">
            <UserRestrictions :user-id="user.id" :disabled="isSelf || !!busy" @changed="emit('changed', { user: target, deleted: false })" />
          </v-window-item>

          <v-window-item value="sessions">
            <div class="d-flex align-center flex-wrap ga-2 mb-3">
              <h3 class="text-subtitle-1">登录设备（{{ sessionTotal }}）</h3>
              <v-spacer />
              <v-btn :disabled="!!busy || sessionsLoading" prepend-icon="mdi-refresh" variant="text" @click="loadSessions">刷新</v-btn>
              <v-btn
                color="error"
                :disabled="!canRevokeSessions || !!busy || sessionsLoading || !sessionTotal"
                :loading="busy === 'revoke-all'"
                variant="outlined"
                @click="askRevokeAll"
              >
                踢出所有设备
              </v-btn>
            </div>
            <p class="text-body-2 mb-3">仅撤销此用户的登录会话，不影响个人 API、OAuth 或编辑器令牌。包含访问令牌已过期但仍可刷新的设备。</p>
            <v-alert v-if="isSelf" class="mb-3" type="info" variant="tonal">为避免退出当前管理员账号，这里不提供对本人设备的撤销操作。</v-alert>
            <v-alert v-if="sessionsError" class="mb-3" type="error" variant="tonal">{{ sessionsError }}</v-alert>
            <v-data-table-server
              v-model:items-per-page="sessionPageSize"
              v-model:page="sessionPage"
              :headers="sessionHeaders"
              item-value="id"
              :items="sessions"
              :items-length="sessionTotal"
              :items-per-page-options="[10, 20, 50]"
              :loading="sessionsLoading"
              loading-text="加载登录设备…"
              :mobile="null"
              no-data-text="暂无有效登录设备"
              @update:options="loadSessions"
            >
              <template #item.name="{ item }">
                <div>{{ deviceName(item) }}</div>
                <div class="text-caption text-medium-emphasis device-agent">{{ item.user_agent || '未记录浏览器信息' }}</div>
              </template>
              <template #item.ip="{ item }">{{ item.last_used_ip || item.ip_address || '未记录' }}</template>
              <template #item.last_used_at="{ item }">{{ formatDate(item.last_used_at) }}</template>
              <template #item.created_at="{ item }">{{ formatDate(item.created_at) }}</template>
              <template #item.expires="{ item }">
                <div>访问：{{ formatDate(item.expires_at) }}</div>
                <div>刷新：{{ formatDate(item.refresh_expires_at) }}</div>
              </template>
              <template #item.actions="{ item }">
                <v-btn
                  color="error"
                  :disabled="!canRevokeSessions || !!busy"
                  :loading="busy === `revoke-${item.id}`"
                  size="small"
                  variant="text"
                  @click="askRevoke(item)"
                >踢出</v-btn>
              </template>
            </v-data-table-server>
          </v-window-item>

          <v-window-item value="data">
            <div class="d-flex align-center ga-2 flex-wrap mb-3">
              <h3 class="text-subtitle-1">本站数据预览</h3>
              <v-spacer />
              <v-btn :disabled="!!busy || summaryLoading" prepend-icon="mdi-refresh" variant="text" @click="loadSummary">刷新预览</v-btn>
            </div>
            <p class="text-body-2 mb-3">
              预览不是锁定快照，执行时以服务器实际处理数量为准。保留他人的项目、帖子和评论正文；
              删除评论空间是例外，会删除空间内访客内容。共享提交图、CAS 文件及全局素材不做物理清理；外部平台副本不保证同步删除。
            </p>
            <v-alert v-if="summaryWarnings.length > 0" class="mb-4" type="warning" variant="tonal">
              <ul class="pl-5"><li v-for="warning in summaryWarnings" :key="warning">{{ warning }}</li></ul>
            </v-alert>
            <v-table v-if="categories.length > 0" class="mb-4" density="comfortable">
              <thead><tr><th>清理类别</th><th class="text-end">预览数量</th><th>影响范围</th></tr></thead>
              <tbody>
                <tr v-for="category in categories" :key="category.key">
                  <td>
                    <v-checkbox
                      v-model="selectedCategories"
                      :color="category.dangerous || category.key === 'commentSpaces' ? 'error' : 'primary'"
                      density="compact"
                      :disabled="!canManage || !!busy"
                      hide-details
                      :label="category.label"
                      :value="category.key"
                    />
                  </td>
                  <td class="text-end">{{ category.count }}</td>
                  <td class="category-description">{{ category.description }}</td>
                </tr>
              </tbody>
            </v-table>
            <h3 class="text-subtitle-1 mb-2">按类别清理，保留账号</h3>
            <p class="text-body-2 mb-3">所有类别默认不选。只清理勾选的数据，不修改联系方式、TOTP、Passkey、角色或登录身份；未选数据保留。仅参与协作的他人项目不会删除，收藏夹内收录的项目也不会删除。</p>
            <div v-if="selectedPreview.length > 0" aria-live="polite" class="text-body-2 mb-3">
              本次选择：{{ selectedPreview.map(item => `${item.label} ${item.count}`).join('；') }}
            </div>
            <v-text-field
              v-model="cleanupUsername"
              autocomplete="off"
              :disabled="!canManage || !!busy"
              :label="`输入用户名 ${target.username} 以确认清理`"
              spellcheck="false"
              variant="outlined"
            />
            <v-checkbox
              v-if="includesCommentSpaces"
              v-model="confirmCleanupSpaces"
              class="mb-3"
              color="error"
              :disabled="!canManage || !!busy"
              hide-details
              :label="`我确认删除评论空间及其中的访客评论（预览 ${spaceCommentCount} 条），这些不是仅属于该用户的内容`"
            />
            <v-btn
              color="error"
              :disabled="!canCleanup"
              :loading="busy === 'cleanup'"
              variant="outlined"
              @click="cleanup"
            >清理所选数据（保留账号）</v-btn>

            <v-divider class="my-6" />
            <v-card class="pa-4" variant="outlined">
              <h3 class="text-subtitle-1 text-error mb-2">永久删除账号</h3>
              <p class="text-body-2 mb-3">与分类清理相互独立。删除账号、全部本站自有内容、登录身份与附属数据，不能恢复。自有 OAuth 应用删除后，该应用下其他用户的令牌及授权也会失效。</p>
              <v-btn
                v-if="!showDelete"
                color="error"
                :disabled="!canManage || !!busy"
                variant="text"
                @click="showDelete = true"
              >查看永久删除预览</v-btn>
              <div v-else>
                <ul class="pl-5 mb-4 text-body-2">
                  <li v-for="category in categories" :key="category.key">{{ category.label }}：{{ category.count }}</li>
                  <li v-for="entry in accountPreview" :key="entry.key">{{ entry.label }}：{{ entry.count }}</li>
                </ul>
                <p class="text-body-2 mb-3">上方分类勾选不限制永久删除范围。联系方式、安全设置、角色、邀请等账号附属记录均会删除或解除关联；共享资源与外部副本限制仍然适用。</p>
                <v-text-field
                  v-model="deleteUsername"
                  autocomplete="off"
                  :disabled="!canManage || !!busy"
                  :label="`输入用户名 ${target.username} 以永久删除`"
                  spellcheck="false"
                  variant="outlined"
                />
                <v-checkbox
                  v-model="confirmDeleteSpaces"
                  class="mb-3"
                  color="error"
                  :disabled="!canManage || !!busy"
                  hide-details
                  :label="`我确认删除全部评论空间及其中的访客评论（预览 ${spaceCommentCount} 条）`"
                />
                <v-checkbox
                  v-model="confirmPermanentDelete"
                  class="mb-4"
                  color="error"
                  :disabled="!canManage || !!busy"
                  hide-details
                  label="我理解账号与全部上述数据将永久删除，无法恢复"
                />
                <v-btn color="error" :disabled="!canDelete" :loading="busy === 'delete'" @click="deleteAccount">永久删除账号及数据</v-btn>
              </div>
            </v-card>
          </v-window-item>
        </v-window>
      </v-card-text>
      <v-divider />
      <v-card-actions><v-spacer /><v-btn :disabled="!!busy" variant="text" @click="close">关闭</v-btn></v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmation.show" max-width="520" :persistent="!!busy">
    <v-card>
      <v-card-title>{{ confirmation.title }}</v-card-title>
      <v-card-text>
        <p class="mb-3">目标用户：<strong>{{ target.username }}</strong>（#{{ user.id }}）</p>
        <p>{{ confirmation.description }}</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="!!busy" variant="text" @click="confirmation.show = false">取消</v-btn>
        <v-btn color="error" :disabled="!!busy" @click="runConfirmedAction">{{ confirmation.title }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  import {computed, ref, watch} from 'vue';
  import axios from '@/axios/axios';
  import {useSudoManager} from '@/composables/useSudoManager';
  import {localuser} from '@/services/localAccount';
  import UserRestrictions from '@/components/admin/UserRestrictions.vue';

  const props = defineProps({
    modelValue: Boolean,
    user: {type: Object, required: true},
    initialTab: {type: String, default: 'account'},
  });
  const emit = defineEmits(['update:modelValue', 'changed']);
  const sudoManager = useSudoManager();
  const tab = ref('account');
  const summary = ref(null);
  const summaryLoading = ref(false);
  const summaryError = ref('');
  const sessions = ref([]);
  const sessionTotal = ref(0);
  const sessionPage = ref(1);
  const sessionPageSize = ref(10);
  const sessionsLoading = ref(false);
  const sessionsError = ref('');
  const busy = ref('');
  const accountDeleted = ref(false);
  const error = ref('');
  const result = ref(null);
  const resultWarnings = ref([]);
  const nextStatus = ref('active');
  const selectedCategories = ref([]);
  const cleanupUsername = ref('');
  const confirmCleanupSpaces = ref(false);
  const showDelete = ref(false);
  const deleteUsername = ref('');
  const confirmDeleteSpaces = ref(false);
  const confirmPermanentDelete = ref(false);
  const confirmation = ref({show: false});
  let generation = 0;
  let summaryRequest = 0;
  let sessionsRequest = 0;

  const categoryKeys = new Set(['posts', 'projects', 'lists', 'comments', 'interactions', 'commentSpaces']);
  const countLabels = {
    posts: '帖子', projects: '项目（含文章）', lists: '收藏夹', comments: '评论',
    interactions: '互动记录', commentSpaces: '评论空间', tokens: '全部类型令牌',
    contacts: '联系方式及账号连接', oauthApplications: '自有 OAuth 应用',
    oauthAuthorizations: 'OAuth 授权', commentSpaceComments: '空间内评论（含访客内容）',
    sessions: '登录设备', count: '实际处理数量',
    affectedTokens: '自有 OAuth 应用下受影响令牌', thirdPartyTokens: '自有应用下其他用户的令牌',
    legacyOauthTokens: '旧版 OAuth 令牌', commentSpaceVisitors: '评论空间访客',
    totp: '双重验证设置', magicLinks: '免密登录链接', pushSubscriptions: '推送订阅',
    passkeys: 'Passkey', roles: '角色授权', invitations: '邀请',
  };
  const statusOptions = [
    {title: '活跃', value: 'active'}, {title: '已暂停', value: 'suspended'},
    {title: '已封禁', value: 'banned'}, {title: '待验证', value: 'pending'},
  ];
  const sessionHeaders = [
    {title: '设备 / 浏览器', key: 'name', sortable: false},
    {title: 'IP', key: 'ip', sortable: false},
    {title: '最近使用', key: 'last_used_at', sortable: false},
    {title: '创建时间', key: 'created_at', sortable: false},
    {title: '有效期', key: 'expires', sortable: false},
    {title: '操作', key: 'actions', sortable: false},
  ];
  const target = computed(() => summary.value?.user || props.user);
  const isSelf = computed(() => summary.value?.protections?.self === true || String(localuser.user.value?.id) === String(props.user.id));
  const canManage = computed(() => !!summary.value && !summaryLoading.value && !summaryError.value && summary.value.protections?.canManage === true && !isSelf.value && !summary.value.protections?.admin && !isAdminType(target.value.type));
  const protectionReason = computed(() => summary.value?.protections?.reason || (isSelf.value ? '不能对本人变更状态、清理数据或删除账号。' : '该用户受到管理员保护，请先在编辑资料中单独调整权限。'));
  const canRevokeSessions = computed(() => !!summary.value && !summaryLoading.value && !summaryError.value && !isSelf.value);
  const categories = computed(() => (summary.value?.categories || []).filter(item => categoryKeys.has(item.key)));
  const selectedPreview = computed(() => categories.value.filter(item => selectedCategories.value.includes(item.key)));
  const includesCommentSpaces = computed(() => selectedCategories.value.includes('commentSpaces'));
  const spaceCommentCount = computed(() => summary.value?.account?.commentSpaceComments ?? '未知');
  const summaryWarnings = computed(() => summary.value?.warnings || []);
  const accountPreview = computed(() => flattenCounts(summary.value?.account || {}));
  const resultCounts = computed(() => result.value ? flattenCounts(result.value.counts || (typeof result.value.count === 'number' ? {count: result.value.count} : {})) : []);
  const canCleanup = computed(() => canManage.value && !busy.value && selectedPreview.value.length > 0 && cleanupUsername.value === target.value.username && (!includesCommentSpaces.value || confirmCleanupSpaces.value));
  const canDelete = computed(() => canManage.value && !busy.value && deleteUsername.value === target.value.username && confirmDeleteSpaces.value && confirmPermanentDelete.value);
  const apiPath = () => `/admin/users/${props.user.id}`;
  const isAdminType = type => ['admin', 'administrator'].includes(type);
  const statusLabel = status => statusOptions.find(item => item.value === status)?.title || status;
  const errorMessage = (err, fallback) => err.response?.data?.message || err.response?.data?.error || err.message || fallback;

  function flattenCounts(value, prefix = '') {
    return Object.entries(value).flatMap(([key, count]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof count === 'number') return [{key: path, label: countLabels[key] || path, count}];
      return count && typeof count === 'object' && !Array.isArray(count) ? flattenCounts(count, path) : [];
    });
  }
  function formatDate(value) {
    if (!value) return '未记录';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString('zh-CN', {hour12: false});
  }
  function deviceName(item) {
    const info = item.device_info;
    return item.name || (info && typeof info === 'object' && (info.device_name || info.browser?.name || info.device?.model)) || '未命名设备';
  }
  function close() {
    if (busy.value) return;
    confirmation.value.show = false;
    emit('update:modelValue', false);
  }
  async function loadSummary() {
    const currentGeneration = generation;
    const request = ++summaryRequest;
    summaryLoading.value = true;
    summaryError.value = '';
    try {
      const {data} = await axios.get(`${apiPath()}/data-summary`);
      if (currentGeneration !== generation || request !== summaryRequest) return false;
      summary.value = data;
      nextStatus.value = data.user.status;
      selectedCategories.value = selectedCategories.value.filter(key => data.categories.some(item => item.key === key));
      return true;
    } catch (error_) {
      if (currentGeneration === generation && request === summaryRequest) {
        summaryError.value = errorMessage(error_, '加载数据预览失败');
      }
      return false;
    } finally {
      if (currentGeneration === generation && request === summaryRequest) summaryLoading.value = false;
    }
  }
  async function loadSessions() {
    if (!props.modelValue || tab.value !== 'sessions') return false;
    const currentGeneration = generation;
    const request = ++sessionsRequest;
    sessionsLoading.value = true;
    sessionsError.value = '';
    try {
      const {data} = await axios.get(`${apiPath()}/sessions`, {params: {page: sessionPage.value, itemsPerPage: sessionPageSize.value}});
      if (currentGeneration !== generation || request !== sessionsRequest) return false;
      const maxPage = Math.max(1, Math.ceil(Number(data.total) / sessionPageSize.value));
      if (sessionPage.value > maxPage) {
        sessionPage.value = maxPage;
        return await loadSessions();
      }
      sessions.value = data.items;
      sessionTotal.value = Number(data.total);
      return true;
    } catch (error_) {
      if (currentGeneration === generation && request === sessionsRequest) sessionsError.value = errorMessage(error_, '加载登录设备失败');
      return false;
    } finally {
      if (currentGeneration === generation && request === sessionsRequest) sessionsLoading.value = false;
    }
  }
  function askStatus() {
    if (!canManage.value || busy.value) return;
    confirmation.value = {
      show: true, kind: 'status', status: nextStatus.value, title: '变更账号状态',
      description: `将 ${statusLabel(target.value.status)} 改为 ${statusLabel(nextStatus.value)}。封禁或暂停将撤销全部类型令牌；恢复活跃不会恢复旧令牌。不会删除内容。`,
    };
  }
  function askRevoke(item) {
    if (!canRevokeSessions.value || busy.value) return;
    confirmation.value = {show: true, kind: 'revoke', tokenId: item.id, title: '踢出此设备', description: `撤销设备「${deviceName(item)}」的登录会话（IP：${item.last_used_ip || item.ip_address || '未记录'}）。该设备需重新登录，其他设备不受影响。`};
  }
  function askRevokeAll() {
    if (!canRevokeSessions.value || busy.value) return;
    confirmation.value = {show: true, kind: 'revoke-all', title: '踢出所有设备', description: `撤销此用户全部登录会话（当前预览 ${sessionTotal.value} 个）。不撤销个人 API、OAuth 或编辑器令牌，不删除内容。`};
  }
  function recordSuccess(data, fallback) {
    result.value = {...data, message: data.message || fallback};
    resultWarnings.value = [...(data.warnings || [])];
    error.value = '';
  }
  async function refreshAfterMutation(includeSessions = false) {
    const jobs = [loadSummary()];
    if (includeSessions) jobs.push(loadSessions());
    const refreshed = await Promise.all(jobs);
    if (refreshed.some(ok => !ok)) resultWarnings.value.push('操作已完成，但部分预览刷新失败；请刷新后核对，勿重复执行操作。');
  }
  async function runConfirmedAction() {
    if (busy.value) return;
    const action = {...confirmation.value};
    if (action.kind === 'status' ? !canManage.value : !canRevokeSessions.value) return;
    confirmation.value.show = false;
    busy.value = action.kind === 'revoke' ? `revoke-${action.tokenId}` : action.kind;
    error.value = '';
    result.value = null;
    resultWarnings.value = [];
    try {
      let response;
      if (action.kind === 'status') {
        response = await axios.post(`${apiPath()}/status`, {status: action.status});
        summary.value = {...summary.value, user: {...target.value, status: action.status}};
      } else if (action.kind === 'revoke') {
        response = await axios.delete(`${apiPath()}/sessions/${encodeURIComponent(action.tokenId)}`);
      } else {
        response = await axios.post(`${apiPath()}/sessions/revoke-all`);
      }
      recordSuccess(response.data, '操作已完成');
      emit('changed', {user: {...target.value}, deleted: false});
      await refreshAfterMutation(action.kind !== 'status');
    } catch (error_) {
      error.value = errorMessage(error_, '操作失败');
    } finally {
      busy.value = '';
    }
  }
  async function destructiveAction(kind) {
    if (kind === 'cleanup' ? !canCleanup.value : !canDelete.value) return;
    const payload = kind === 'cleanup'
      ? {categories: [...selectedCategories.value], confirmUsername: cleanupUsername.value, confirmCommentSpaces: confirmCleanupSpaces.value}
      : {confirmUsername: deleteUsername.value, confirmCommentSpaces: true};
    busy.value = kind;
    error.value = '';
    result.value = null;
    resultWarnings.value = [];
    try {
      const sudoToken = await sudoManager.requireSudo({
        title: kind === 'cleanup' ? '验证身份以清理用户数据' : '验证身份以永久删除账号',
        subtitle: `目标用户：${target.value.username}（#${props.user.id}），验证当前管理员身份`,
      });
      // Do not use addSudoToRequest: it replaces the Bearer Authorization header.
      const config = {headers: {'X-Sudo-Token': sudoToken}};
      const {data} = kind === 'cleanup'
        ? await axios.post(`${apiPath()}/cleanup`, payload, config)
        : await axios.delete(apiPath(), {...config, data: payload});
      recordSuccess(data, kind === 'cleanup' ? '所选数据已清理，账号已保留' : '账号已永久删除');
      emit('changed', {user: {...target.value}, deleted: kind === 'delete', result: data});
      if (kind === 'delete') {
        accountDeleted.value = true;
      } else {
        selectedCategories.value = [];
        cleanupUsername.value = '';
        confirmCleanupSpaces.value = false;
        await refreshAfterMutation();
      }
    } catch (error_) {
      if (!['cancel', 'cancelled'].includes(error_?.type)) error.value = errorMessage(error_, '操作失败，确认信息已保留');
      if (String(error_.response?.data?.code || '').startsWith('SUDO_')) sudoManager.clearSudo();
    } finally {
      busy.value = '';
    }
  }
  const cleanup = () => destructiveAction('cleanup');
  const deleteAccount = () => destructiveAction('delete');

  watch([() => props.modelValue, () => props.user.id], ([open]) => {
    generation++;
    if (!open) return;
    tab.value = props.initialTab;
    summary.value = null;
    summaryError.value = '';
    sessions.value = [];
    sessionTotal.value = 0;
    sessionPage.value = 1;
    sessionsLoading.value = false;
    sessionsError.value = '';
    error.value = '';
    result.value = null;
    resultWarnings.value = [];
    accountDeleted.value = false;
    selectedCategories.value = [];
    cleanupUsername.value = '';
    confirmCleanupSpaces.value = false;
    showDelete.value = false;
    deleteUsername.value = '';
    confirmDeleteSpaces.value = false;
    confirmPermanentDelete.value = false;
    confirmation.value = {show: false};
    nextStatus.value = props.user.status;
    loadSummary();
    if (tab.value === 'sessions') loadSessions();
  }, {immediate: true});
  watch(tab, value => {
    if (value === 'sessions') loadSessions();
  });
  watch(includesCommentSpaces, () => { confirmCleanupSpaces.value = false; });
</script>

<style scoped>
.management-body { min-height: 260px; }
.account-details { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px 24px; }
.account-details dt { color: rgb(var(--v-theme-on-surface), 0.7); }
.account-details dd { margin: 0; overflow-wrap: anywhere; }
.category-description { min-width: 180px; white-space: normal; }
.device-agent { max-width: 260px; overflow-wrap: anywhere; white-space: normal; }
</style>
