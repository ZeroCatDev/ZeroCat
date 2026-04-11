<template>
  <div class="project-selector">
    <!-- 紧凑模式：自动完成输入框 -->
    <v-autocomplete
      v-if="compact"
      v-model="selectedItem"
      :items="searchResults"
      :loading="loading"
      item-value="id"
      item-title="title"
      :label="label"
      :placeholder="placeholder"
      :density="density"
      :variant="variant"
      :hide-details="hideDetails"
      :disabled="disabled"
      clearable
      no-filter
      return-object
      @update:search="onSearch"
      @update:model-value="onSelect"
    >
      <template #prepend-item>
        <v-list-item density="compact" class="px-3">
          <v-switch
            v-model="onlyMine"
            label="仅我的项目"
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
            <v-avatar size="32" rounded="lg">
              <v-img :src="getS3staticurl(item.raw.thumbnail)" />
            </v-avatar>
          </template>
          <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
          <v-list-item-subtitle>
            @{{ item.raw.author?.username }}
            <v-chip
              size="x-small"
              :color="item.raw.state === 'public' ? 'success' : 'warning'"
              variant="tonal"
              class="ml-1"
            >
              {{ item.raw.state === 'public' ? '公开' : '私有' }}
            </v-chip>
          </v-list-item-subtitle>
        </v-list-item>
      </template>

      <template #selection="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="20" rounded="lg" class="mr-2">
            <v-img :src="getS3staticurl(item.raw.thumbnail)" />
          </v-avatar>
          <span class="text-truncate">{{ item.raw.title }}</span>
        </div>
      </template>

      <template #no-data>
        <v-list-item>
          <v-list-item-title class="text-grey text-center">
            {{ loading ? '搜索中...' : searchQuery ? '未找到项目' : '输入搜索或ID' }}
          </v-list-item-title>
        </v-list-item>
      </template>

      <template #append-inner>
        <v-tooltip text="提示：可直接输入项目ID或用户名/项目名" location="top">
          <template #activator="{ props: tipProps }">
            <v-icon v-bind="tipProps" size="16" class="text-grey">mdi-information-outline</v-icon>
          </template>
        </v-tooltip>
      </template>
    </v-autocomplete>

    <!-- 标准模式：卡片选择器 -->
    <template v-else>
      <v-card
        class="cursor-pointer"
        @click="openDialog"
        elevation="1"
        rounded="lg"
      >
        <v-card-text class="d-flex align-center justify-space-between py-3">
          <div v-if="!selectedProject" class="text-grey-600">
            {{ multiple ? "选择项目..." : "选择一个项目..." }}
          </div>
          <div v-else-if="!multiple" class="d-flex align-center">
            <v-avatar size="32" rounded="lg" class="me-2">
              <v-img :src="getS3staticurl(selectedProject.thumbnail)" />
            </v-avatar>
            <div>
              <div class="text-subtitle-2">{{ selectedProject.title }}</div>
              <div class="text-caption text-grey-600">
                @{{ selectedProject.author?.username }}
              </div>
            </div>
          </div>
          <div v-else>
            <span class="text-subtitle-2">已选择 {{ selectedProjects.length }} 个项目</span>
          </div>
          <v-icon>mdi-chevron-down</v-icon>
        </v-card-text>
      </v-card>

      <!-- 选择对话框 -->
      <v-dialog v-model="dialog" max-width="800" scrollable>
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between pa-4">
            <span>选择项目</span>
            <v-btn icon variant="text" size="small" @click="dialog = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>

          <v-card-text class="pa-4">
            <!-- 搜索栏 -->
            <v-row class="mb-4">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="searchQuery"
                  label="搜索项目"
                  placeholder="输入项目名或ID"
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  @update:model-value="debouncedSearch"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-select
                  v-model="sortBy"
                  :items="sortOptions"
                  label="排序"
                  variant="outlined"
                  density="compact"
                  hide-details
                  @update:model-value="loadProjects"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch
                  v-model="onlyMine"
                  label="仅我的"
                  density="compact"
                  hide-details
                  color="primary"
                  @update:model-value="loadProjects"
                />
              </v-col>
            </v-row>

            <!-- 加载中 -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate />
            </div>

            <!-- 项目列表 -->
            <v-row v-else-if="projects.length">
              <v-col
                v-for="project in projects"
                :key="project.id"
                cols="6"
                sm="4"
                md="3"
              >
                <v-card
                  :class="['project-card', { selected: isSelected(project.id) }]"
                  rounded="lg"
                  @click="toggleSelect(project)"
                >
                  <v-img
                    :src="getS3staticurl(project.thumbnail)"
                    :aspect-ratio="4/3"
                    cover
                    class="align-end"
                    gradient="to bottom, transparent 60%, rgba(0,0,0,0.7)"
                  >
                    <v-card-title class="text-white text-body-2 pa-2">
                      {{ project.title }}
                    </v-card-title>
                  </v-img>
                  <v-card-text class="pa-2 text-caption">
                    @{{ project.author?.username }}
                    <v-icon v-if="isSelected(project.id)" color="primary" size="16" class="float-right">
                      mdi-check-circle
                    </v-icon>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- 空状态 -->
            <div v-else class="text-center py-8 text-grey">
              <v-icon size="48" class="mb-2">mdi-folder-open-outline</v-icon>
              <div>未找到项目</div>
            </div>

            <!-- 分页 -->
            <div v-if="totalCount > limit" class="d-flex justify-center mt-4">
              <v-pagination
                v-model="page"
                :length="Math.ceil(totalCount / limit)"
                :total-visible="5"
                density="compact"
                @update:model-value="loadProjects(false)"
              />
            </div>
          </v-card-text>

          <v-card-actions v-if="multiple" class="pa-4">
            <v-spacer />
            <v-btn variant="text" @click="dialog = false">取消</v-btn>
            <v-btn color="primary" variant="flat" @click="confirmSelection">
              确认 ({{ selectedProjects.length }})
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import axios from '@/axios/axios';
import { localuser } from '@/services/localAccount';
import { getS3staticurl, getProjectInfoByNamespace } from '@/services/projectService';

const props = defineProps({
  modelValue: { type: [Number, Array], default: null },
  multiple: { type: Boolean, default: false },
  limit: { type: Number, default: 20 },
  compact: { type: Boolean, default: false },
  label: { type: String, default: '选择项目' },
  placeholder: { type: String, default: '搜索或输入ID' },
  density: { type: String, default: 'default' },
  variant: { type: String, default: 'outlined' },
  hideDetails: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  defaultOnlyMine: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'select']);

// State
const dialog = ref(false);
const loading = ref(false);
const projects = ref([]);
const searchResults = ref([]);
const searchQuery = ref('');
const sortBy = ref('time_down');
const page = ref(1);
const totalCount = ref(0);
const onlyMine = ref(props.defaultOnlyMine);
const selectedItem = ref(null);
const selectedProjectsMap = ref(new Map());

let searchTimeout = null;

const sortOptions = [
  { title: '最新', value: 'time_down' },
  { title: '最早', value: 'time_up' },
  { title: '最热', value: 'view_down' }
];

// Computed
const selectedProject = computed(() => {
  if (props.multiple) return null;
  return selectedProjectsMap.value.get(props.modelValue) || selectedItem.value || null;
});

const selectedProjects = computed(() => Array.from(selectedProjectsMap.value.values()));

const isSelected = (id) => selectedProjectsMap.value.has(id);

// 解析直接输入 (ID 或 username/projectname)
const parseDirectInput = (input) => {
  if (!input?.trim()) return null;
  const trimmed = input.trim();

  // 纯数字ID
  if (/^\d+$/.test(trimmed)) {
    return { type: 'id', value: parseInt(trimmed, 10) };
  }

  // username/projectname 格式
  const match = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (match) {
    return { type: 'namespace', username: match[1], projectname: match[2] };
  }

  return null;
};

// 搜索处理
const onSearch = (query) => {
  searchQuery.value = query;
  clearTimeout(searchTimeout);

  if (!query) {
    searchResults.value = [];
    return;
  }

  searchTimeout = setTimeout(() => doSearch(query), 300);
};

const doSearch = async (query) => {
  if (!query) return;

  loading.value = true;
  try {
    // 先尝试直接解析
    const parsed = parseDirectInput(query);
    if (parsed) {
      let project = null;
      try {
        if (parsed.type === 'id') {
          const res = await axios.get(`/project/id/${parsed.value}`);
          project = res.data?.data || res.data;
        } else {
          const res = await getProjectInfoByNamespace(parsed.username, parsed.projectname);
          project = res?.data || res;
        }
      } catch (e) {
        // 继续搜索
      }

      if (project?.id) {
        searchResults.value = [project];
        loading.value = false;
        return;
      }
    }

    // 正常搜索
    const params = {
      keyword: query,
      scope: 'projects',
      page: 1,
      perPage: 10,
      orderBy: 'time_down'
    };

    if (onlyMine.value && localuser.user.value?.id) {
      params.userId = localuser.user.value.id;
    }

    const res = await axios.get('/searchapi', { params });
    searchResults.value = res.data?.projects || [];
  } catch (e) {
    console.error('Search failed:', e);
    searchResults.value = [];
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadProjects(), 300);
};

// 加载项目列表（对话框用）
const loadProjects = async (reset = true) => {
  if (reset) page.value = 1;

  loading.value = true;
  try {
    const params = {
      scope: 'projects',
      page: page.value,
      perPage: props.limit,
      orderBy: sortBy.value
    };

    if (searchQuery.value) {
      params.keyword = searchQuery.value;
    }

    if (onlyMine.value && localuser.user.value?.id) {
      params.userId = localuser.user.value.id;
    }

    const res = await axios.get('/searchapi', { params });
    projects.value = res.data?.projects || [];
    totalCount.value = res.data?.totalCount || res.data?.totals?.projects || 0;
  } catch (e) {
    console.error('Failed to load projects:', e);
    projects.value = [];
  } finally {
    loading.value = false;
  }
};

// 选择处理
const onSelect = (item) => {
  if (item) {
    selectedProjectsMap.value.clear();
    selectedProjectsMap.value.set(item.id, item);
    emit('update:modelValue', item.id);
    emit('select', item);
  } else {
    selectedProjectsMap.value.clear();
    emit('update:modelValue', null);
    emit('select', null);
  }
};

const toggleSelect = (project) => {
  if (props.multiple) {
    if (selectedProjectsMap.value.has(project.id)) {
      selectedProjectsMap.value.delete(project.id);
    } else {
      selectedProjectsMap.value.set(project.id, project);
    }
  } else {
    selectedProjectsMap.value.clear();
    selectedProjectsMap.value.set(project.id, project);
    emit('update:modelValue', project.id);
    emit('select', project);
    dialog.value = false;
  }
};

const confirmSelection = () => {
  const ids = Array.from(selectedProjectsMap.value.keys());
  emit('update:modelValue', ids);
  emit('select', selectedProjects.value);
  dialog.value = false;
};

const openDialog = () => {
  dialog.value = true;
  if (!projects.value.length) loadProjects();
};

// 初始化已选项目
const initSelection = async () => {
  if (!props.modelValue) {
    selectedProjectsMap.value.clear();
    selectedItem.value = null;
    return;
  }

  const ids = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue];

  try {
    const res = await axios.post('/project/batch', { projectIds: ids });
    const list = res.data?.data || res.data?.projects || res.data || [];

    selectedProjectsMap.value.clear();
    list.forEach((p) => {
      if (p?.id) selectedProjectsMap.value.set(p.id, p);
    });

    if (!props.multiple && list.length) {
      selectedItem.value = list[0];
    }
  } catch (e) {
    console.error('Failed to load project details:', e);
  }
};

// Watch
watch(() => props.modelValue, () => {
  nextTick(initSelection);
}, { immediate: true });

watch(onlyMine, () => {
  if (props.compact) {
    doSearch(searchQuery.value);
  }
});

onMounted(() => {
  if (!props.compact) loadProjects();
});
</script>

<style scoped>
.project-card {
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.project-card.selected {
  ring: 2px solid rgb(var(--v-theme-primary));
  outline: 2px solid rgb(var(--v-theme-primary));
}
</style>
