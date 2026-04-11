<template>
  <div class="list-selector">
    <v-autocomplete
      v-model="selectedItem"
      :items="lists"
      :loading="loading"
      :search="searchQuery"
      item-value="id"
      item-title="title"
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
      <template #prepend-item>
        <v-list-item density="compact" class="px-3">
          <v-switch
            v-model="showOnlyMine"
            label="仅显示我的列表"
            density="compact"
            hide-details
            color="primary"
            class="mt-0"
          />
        </v-list-item>
        <v-divider class="mb-1" />
      </template>

      <template #item="{ item, props: itemProps }">
        <v-list-item v-bind="itemProps" :title="undefined">
          <template #prepend>
            <v-avatar size="32" color="primary" variant="tonal">
              <v-icon size="18">mdi-playlist-play</v-icon>
            </v-avatar>
          </template>
          <v-list-item-title>{{ item.raw.title || item.raw.name }}</v-list-item-title>
          <v-list-item-subtitle>
            <span v-if="item.raw.author">
              @{{ item.raw.author.username || item.raw.author.display_name }}
            </span>
            <span v-if="item.raw.description" class="ml-2 text-grey">
              {{ item.raw.description }}
            </span>
          </v-list-item-subtitle>
        </v-list-item>
      </template>

      <template #selection="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="24" color="primary" variant="tonal" class="mr-2">
            <v-icon size="14">mdi-playlist-play</v-icon>
          </v-avatar>
          <span>{{ item.raw.title || item.raw.name }}</span>
        </div>
      </template>

      <template #no-data>
        <v-list-item>
          <v-list-item-title class="text-grey">
            {{ loading ? '加载中...' : '未找到列表' }}
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-autocomplete>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { getMyProjectLists } from '@/services/projectListService';
import axios from '@/axios/axios';

const props = defineProps({
  modelValue: { type: [Number, Object], default: null },
  label: { type: String, default: '选择列表' },
  placeholder: { type: String, default: '搜索列表...' },
  density: { type: String, default: 'default' },
  variant: { type: String, default: 'outlined' },
  hideDetails: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  onlyMine: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'select']);

const selectedItem = ref(null);
const lists = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const showOnlyMine = ref(props.onlyMine);

let searchTimeout = null;

const onSearch = (query) => {
  searchQuery.value = query;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadLists();
  }, 300);
};

const loadLists = async () => {
  loading.value = true;
  try {
    if (showOnlyMine.value) {
      // 获取我的列表
      const res = await getMyProjectLists();
      // 处理各种可能的响应格式
      let listData = [];
      if (res?.status === 'success' && res?.data) {
        listData = Array.isArray(res.data) ? res.data : (res.data.lists || []);
      } else if (res?.lists) {
        listData = res.lists;
      } else if (Array.isArray(res)) {
        listData = res;
      }
      lists.value = listData;
    } else {
      // 搜索所有列表 - 使用 searchapi
      try {
        const params = {
          scope: 'lists',
          keyword: searchQuery.value || '',
          perPage: 20
        };
        const res = await axios.get('/searchapi', { params });
        lists.value = res.data?.lists || res.data?.results || [];
      } catch (e) {
        // 如果搜索接口不支持列表，回退到仅我的列表
        console.warn('List search not supported, falling back to my lists');
        showOnlyMine.value = true;
        await loadLists();
        return;
      }
    }

    // 过滤搜索结果
    if (searchQuery.value && lists.value.length) {
      const query = searchQuery.value.toLowerCase();
      lists.value = lists.value.filter(
        (l) => (l.title || l.name)?.toLowerCase().includes(query)
      );
    }
  } catch (e) {
    console.error('Failed to load lists:', e);
    lists.value = [];
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

watch(showOnlyMine, () => {
  loadLists();
});

watch(() => props.modelValue, (val) => {
  if (val && typeof val === 'object') {
    selectedItem.value = val;
  } else if (val) {
    const found = lists.value.find((l) => l.id === val);
    if (found) {
      selectedItem.value = found;
    }
  } else {
    selectedItem.value = null;
  }
}, { immediate: true });

onMounted(() => {
  loadLists();
});
</script>

<style scoped>
.list-selector {
  width: 100%;
}
</style>
