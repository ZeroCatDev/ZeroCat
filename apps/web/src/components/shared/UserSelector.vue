<template>
  <div class="user-selector">
    <v-autocomplete
      v-model="selectedUser"
      :items="users"
      :loading="loading"
      :search="searchQuery"
      item-value="id"
      item-title="display_name"
      :label="label"
      :placeholder="placeholder"
      :density="density"
      :variant="variant"
      :hide-details="hideDetails"
      :disabled="disabled"
      :clearable="clearable"
      no-filter
      return-object
      @update:search="onSearch"
      @update:model-value="onSelect"
    >
      <template #item="{ item, props: itemProps }">
        <v-list-item v-bind="itemProps" :title="undefined">
          <template #prepend>
            <v-avatar size="32">
              <v-img
                v-if="item.raw.avatar"
                :src="getUserAvatar(item.raw.avatar)"
              />
              <v-icon v-else>mdi-account</v-icon>
            </v-avatar>
          </template>
          <v-list-item-title>
            {{ item.raw.display_name || item.raw.username }}
          </v-list-item-title>
          <v-list-item-subtitle>
            @{{ item.raw.username }}
            <span v-if="item.raw.bio" class="ml-2 text-grey">
              {{ item.raw.bio }}
            </span>
          </v-list-item-subtitle>
        </v-list-item>
      </template>

      <template #selection="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="24" class="mr-2">
            <v-img
              v-if="item.raw.avatar"
              :src="getUserAvatar(item.raw.avatar)"
            />
            <v-icon v-else size="16">mdi-account</v-icon>
          </v-avatar>
          <span>{{ item.raw.display_name || item.raw.username }}</span>
          <span class="text-grey ml-1">@{{ item.raw.username }}</span>
        </div>
      </template>

      <template #no-data>
        <v-list-item>
          <v-list-item-title class="text-grey">
            {{ loading ? '搜索中...' : searchQuery ? '未找到用户' : '输入用户名搜索' }}
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-autocomplete>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import axios from '@/axios/axios';
import { localuser } from '@/services/localAccount';

const props = defineProps({
  modelValue: { type: [Number, Object], default: null },
  label: { type: String, default: '选择用户' },
  placeholder: { type: String, default: '搜索用户名...' },
  density: { type: String, default: 'default' },
  variant: { type: String, default: 'outlined' },
  hideDetails: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'select']);

const selectedUser = ref(null);
const users = ref([]);
const loading = ref(false);
const searchQuery = ref('');

let searchTimeout = null;

const getUserAvatar = (avatar) => {
  return localuser.getUserAvatar(avatar);
};

const onSearch = (query) => {
  searchQuery.value = query;
  clearTimeout(searchTimeout);

  if (!query || query.length < 1) {
    users.value = [];
    return;
  }

  searchTimeout = setTimeout(() => {
    searchUsers(query);
  }, 300);
};

const searchUsers = async (query) => {
  if (!query) return;

  loading.value = true;
  try {
    // 使用搜索API搜索用户
    const params = {
      scope: 'users',
      keyword: query,
      perPage: 20
    };
    const res = await axios.get('/searchapi', { params });
    users.value = res.data?.users || res.data?.results || [];
  } catch (e) {
    console.error('Failed to search users:', e);
    users.value = [];
  } finally {
    loading.value = false;
  }
};

const onSelect = (item) => {
  if (item) {
    emit('update:modelValue', item.id);
    emit('select', item);
  } else {
    emit('update:modelValue', null);
    emit('select', null);
  }
};

watch(() => props.modelValue, (val) => {
  if (val && typeof val === 'object') {
    selectedUser.value = val;
  } else if (val) {
    // 如果只有ID，尝试查找完整对象
    const found = users.value.find((u) => u.id === val);
    if (found) {
      selectedUser.value = found;
    }
  } else {
    selectedUser.value = null;
  }
}, { immediate: true });
</script>

<style scoped>
.user-selector {
  width: 100%;
}
</style>
