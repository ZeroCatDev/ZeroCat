<template>
  <v-container>
    <v-card>
      <v-card-title>
        联邦用户管理
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          append-icon="mdi-magnify"
          label="搜索用户"
          single-line
          hide-details
          disabled
        ></v-text-field>
      </v-card-title>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="users"
        :items-length="totalUsers"
        :loading="loading"
        item-value="user.id"
        @update:options="loadItems"
      >
        <template v-slot:item.user.avatar="{ item }">
             <v-avatar :image="item.user.avatar"></v-avatar>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn size="small" color="primary" class="mr-2" @click="viewFollowers(item)">
            查看关注者
          </v-btn>
          <v-btn size="small" color="warning" @click="backfill(item)">
            历史回填
          </v-btn>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Followers Dialog -->
    <v-dialog v-model="dialog" max-width="800px">
        <v-card>
            <v-card-title>远程关注者: {{ selectedUser?.user.username }}</v-card-title>
            <v-card-text>
                <v-data-table-server
                    v-model:items-per-page="followersItemsPerPage"
                    :headers="followerHeaders"
                    :items="followers"
                    :items-length="totalFollowers"
                    :loading="followersLoading"
                    @update:options="loadFollowers"
                >
                     <template v-slot:item.actorUrl="{ item }">
                        <a :href="item.actorUrl" target="_blank">{{ item.actorUrl }}</a>
                     </template>
                </v-data-table-server>
            </v-card-text>
            <v-card-actions>
                <v-btn color="primary" block @click="dialog = false">关闭</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
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
    { title: '头像', key: 'user.avatar', sortable: false },
    { title: 'ID', key: 'user.id' },
    { title: '用户名', key: 'user.username' },
    { title: '显示名', key: 'user.display_name' },
    { title: '远程关注者', key: 'remoteFollowersCount' },
    { title: '操作', key: 'actions', sortable: false },
];

// Dialog & Followers
const dialog = ref(false);
const selectedUser = ref(null);
const followers = ref([]);
const totalFollowers = ref(0);
const followersLoading = ref(false);
const followersItemsPerPage = ref(10);
const followersPage = ref(1);

const followerHeaders = [
    { title: 'Actor URL', key: 'actorUrl' },
    { title: 'Inbox', key: 'inbox' },
];

const loadItems = async ({ page, itemsPerPage }) => {
    loading.value = true;
    try {
        const res = await federationService.getFederatedUsers({
            page: page,
            limit: itemsPerPage
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

const viewFollowers = (item) => {
    selectedUser.value = item;
    followers.value = [];
    totalFollowers.value = 0;
    followersPage.value = 1;
    dialog.value = true;
    // loadFollowers will be triggered by v-data-table-server automatically or we call it
};

const loadFollowers = async ({ page, itemsPerPage }) => {
    if (!selectedUser.value) return;
    followersLoading.value = true;
    try {
        const res = await federationService.getUserFollowers(selectedUser.value.user.id, {
            page: page,
            limit: itemsPerPage
        });
        if (res.data.status === 'ok') {
            followers.value = res.data.data.followers;
            totalFollowers.value = res.data.data.total;
        }
    } catch (e) {
        console.error(e);
    } finally {
        followersLoading.value = false;
    }
};

const backfill = async (item) => {
    if (!confirm(`确定要为用户 ${item.user.username} 触发历史回填吗?`)) return;
    try {
        const res = await federationService.backfillUserPosts(item.user.id);
        if (res.data.status === 'ok') {
            alert(`回填任务已入队: ${res.data.data.jobs} 个任务`);
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};
</script>
