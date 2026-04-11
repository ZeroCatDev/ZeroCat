<template>
  <v-container>
    <v-card>
      <v-card-title>
        远程代理用户管理
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          append-icon="mdi-magnify"
          label="搜索远程用户"
          single-line
          hide-details
          class="mb-4"
          @submit.prevent="loadItems"
          @keyup.enter="loadItems"
        ></v-text-field>
      </v-card-title>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="users"
        :items-length="totalUsers"
        :loading="loading"
        item-value="id"
        @update:options="loadItems"
      >
        <template v-slot:item.actorUrl="{ item }">
             <a :href="item.actorUrl" target="_blank" class="text-caption">{{ item.actorUrl }}</a>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn size="small" color="info" class="mr-2" @click="fetchPosts(item)">
            拉取帖子
          </v-btn>
          <v-btn size="small" color="warning" @click="refresh(item)">
            刷新资料
          </v-btn>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import federationService from '@/services/federationService';

const users = ref([]);
const totalUsers = ref(0);
const loading = ref(false);
const itemsPerPage = ref(10);
const search = ref('');

const headers = [
    { title: 'ID', key: 'id' },
    { title: 'Username', key: 'username' },
    { title: 'Display Name', key: 'display_name' },
    { title: 'Actor URL', key: 'actorUrl' },
    { title: '操作', key: 'actions', sortable: false },
];

const loadItems = async ({ page, itemsPerPage }) => {
    loading.value = true;
    try {
        const res = await federationService.getProxyUsers({
            page: page,
            limit: itemsPerPage,
            q: search.value
        });
        if (res.data.status === 'ok') {
            users.value = res.data.data.users;
            totalUsers.value = res.data.data.total;
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const fetchPosts = async (item) => {
    const maxPosts = prompt('最大拉取数量 (默认 50):', '50');
    if (maxPosts === null) return;

    try {
        const res = await federationService.fetchProxyUserPosts(item.id, { maxPosts: parseInt(maxPosts) });
        if (res.data.status === 'ok') {
            const data = res.data.data;
            alert(`任务已入队: ${data.queued ? '成功' : '失败'}`);
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};

const refresh = async (item) => {
    if (!confirm(`确定要刷新用户 ${item.username} 的资料吗?`)) return;
    try {
        const res = await federationService.refreshProxyUserProfile(item.id);
        if (res.data.status === 'ok') {
            alert('刷新成功');
            loadItems({ page: 1, itemsPerPage: itemsPerPage.value });
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};
</script>
