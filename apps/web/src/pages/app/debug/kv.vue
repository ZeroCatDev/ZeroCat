<!-- KV Storage Management Page -->
<template>
  <v-container>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col class="d-flex justify-space-between align-center" cols="12">
        <h1 class="text-h4">缓存管理</h1>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          创建缓存
        </v-btn>
      </v-col>
    </v-row>

    <!-- Search and Filters -->
    <v-row class="mb-4">
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="searchQuery"
          clearable
          density="comfortable"
          hide-details
          label="缓存键"
          placeholder="输入缓存键以读取特定缓存"
          prepend-inner-icon="mdi-key"
          variant="outlined"
          @input="handleSearch"
        ></v-text-field>
      </v-col>
    </v-row>

    <!-- Data Table -->
    <v-card>
      <v-data-table-server
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :items-per-page="itemsPerPage"
        :items-per-page-options="[10, 25, 50, 100]"
        :loading="loading"
        :page="page"
        class="elevation-1"
        @update:options="handleTableUpdate"
      >
        <!-- Key Column -->
        <template v-slot:item.key="{ item }">
          <div class="font-weight-medium">{{ item.columns.key }}</div>
        </template>

        <!-- Value Column -->
        <template v-slot:item.value="{ item }">
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <div
                class="text-truncate"
                style="max-width: 300px"
                v-bind="props"
              >
                <pre class="value-preview">{{ formatValue(item.columns.value) }}</pre>
              </div>
            </template>
            <pre class="value-full">{{ formatValue(item.columns.value) }}</pre>
          </v-tooltip>
        </template>

        <!-- Actions Column -->
        <template v-slot:item.actions="{ item }">
          <v-btn
            color="primary"
            icon="mdi-pencil"
            size="small"
            variant="text"
            @click="editItem(item.columns)"
          >
          </v-btn>
          <v-btn
            color="error"
            icon="mdi-delete"
            size="small"
            variant="text"
            @click="confirmDelete(item.columns.key)"
          >
          </v-btn>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600px">
      <v-card>
        <v-card-title class="text-h5 pa-4">
          {{ editingItem ? '编辑缓存' : '创建缓存' }}
        </v-card-title>

        <v-card-text class="pa-4">
          <v-form ref="form" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="formData.key"
              :readonly="!!editingItem"
              :rules="[v => !!v || 'Key is required']"
              class="mb-4"
              label="缓存键"
              variant="outlined"
            ></v-text-field>

            <v-textarea
              v-model="formData.value"
              :hint="'支持 JSON 格式'"
              :rules="[v => !!v || '缓存值是必填的']"
              class="font-monospace"
              label="缓存值"
              persistent-hint
              rows="8"
              variant="outlined"
            ></v-textarea>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="closeDialog"
          >
            取消
          </v-btn>
          <v-btn
            :loading="saving"
            color="primary"
            @click="handleSubmit"
          >
            {{ editingItem ? '更新' : '创建' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5 pa-4">
          确认删除
        </v-card-title>
        <v-card-text class="pa-4">
          确定要删除这个缓存吗？此操作无法撤销。
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showDeleteDialog = false"
          >
            取消
          </v-btn>
          <v-btn
            :loading="deleting"
            color="error"
            @click="deleteItem"

          >
            删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          关闭
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import {get, set, remove, list, info} from '../../../services/cachekv';


// Table headers
const headers = [
  {title: '缓存键', key: 'key', sortable: true},
  {title: '缓存值', key: 'value', sortable: false},
  {title: '操作', key: 'actions', sortable: false, align: 'end'}
];

// State
const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const searchQuery = ref('');
const showCreateDialog = ref(false);
const showDeleteDialog = ref(false);
const editingItem = ref(null);
const deleteKey = ref(null);
const form = ref(null);
const page = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);
const sortBy = ref([]);
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

const formData = ref({
  key: '',
  value: ''
});

// Table options update handler
async function handleTableUpdate(options) {
  page.value = options.page;
  itemsPerPage.value = options.itemsPerPage;
  sortBy.value = options.sortBy;
  await loadItems();
}

// Load items
async function loadItems() {
  loading.value = true;
  try {
    if (searchQuery.value.trim()) {
      // If a key is provided, use info to get specific item
      const result = await info(searchQuery.value.trim());
      items.value = [{
        columns: {
          key: searchQuery.value.trim(),
          value: result
        }
      }];
      totalItems.value = 1;
    } else {
      // If no key provided, list all items
      const result = await list({
        page: page.value,
        limit: itemsPerPage.value,
        showValue: true,
        sortField: sortBy.value?.[0]?.key,
        sortOrder: sortBy.value?.[0]?.order,
        total: true
      });
      items.value = result.items.map(item => ({
        columns: item
      }));
      // Update pagination data from the response
      totalItems.value = result.pagination.total;
      page.value = result.pagination.page;
      itemsPerPage.value = result.pagination.limit;
    }
  } catch (error) {
    showError('Failed to load items');
    console.error('Error loading items:', error);
    items.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// Format value for display
function formatValue(value) {
  try {
    if (typeof value === 'string') {
      // Try to parse as JSON for pretty printing
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return value;
  }
}

// CRUD Operations
async function handleSubmit() {
  if (!form.value.validate()) return;

  saving.value = true;
  try {
    const value = formData.value.value;
    // Try to parse as JSON if possible
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    await set(formData.value.key, parsedValue);
    showSuccess(editingItem.value ? 'Item updated successfully' : 'Item created successfully');
    closeDialog();
    loadItems();
  } catch (error) {
    showError('Failed to save item');
    console.error('Error saving item:', error);
  } finally {
    saving.value = false;
  }
}

function editItem(item) {
  editingItem.value = item;
  formData.value = {
    key: item.key,
    value: formatValue(item.value)
  };
  showCreateDialog.value = true;
}

function confirmDelete(key) {
  deleteKey.value = key;
  showDeleteDialog.value = true;
}

async function deleteItem() {
  if (!deleteKey.value) return;

  deleting.value = true;
  try {
    await remove(deleteKey.value);
    showSuccess('Item deleted successfully');
    showDeleteDialog.value = false;
    loadItems();
  } catch (error) {
    showError('Failed to delete item');
    console.error('Error deleting item:', error);
  } finally {
    deleting.value = false;
  }
}

// UI Helpers
function closeDialog() {
  showCreateDialog.value = false;
  editingItem.value = null;
  formData.value = {key: '', value: ''};
}

function showSuccess(text) {
  snackbar.value = {
    show: true,
    text,
    color: 'success'
  };
}

function showError(text) {
  snackbar.value = {
    show: true,
    text,
    color: 'error'
  };
}

// Search
function handleSearch() {
  page.value = 1; // Reset to first page when searching
  loadItems();
}

// Initial load
onMounted(async () => {
  loadItems();
  console.log(await info("ces1_d9978c65"));
});
</script>

<style scoped>
.value-preview {
  margin: 0;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.value-full {
  margin: 0;
  font-family: monospace;
  max-width: 500px;
  max-height: 400px;
  overflow: auto;
}

.font-monospace {
  font-family: monospace !important;
}
</style>
