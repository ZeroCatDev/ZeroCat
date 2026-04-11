<template>
  <v-container>
    <v-card>
      <v-card-title>帖子同步管理</v-card-title>
      <v-tabs v-model="activeTab" bg-color="primary">
        <v-tab value="all">全部</v-tab>
        <v-tab value="twitter">Twitter</v-tab>
        <v-tab value="bluesky">Bluesky</v-tab>
        <v-tab value="activitypub">ActivityPub</v-tab>
      </v-tabs>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="posts"
        :items-length="totalPosts"
        :loading="loading"
        item-value="id"
        @update:options="loadItems"
      >
        <template v-slot:item.content="{ item }">
             <div class="text-truncate" style="max-width: 300px;">{{ item.content }}</div>
        </template>

        <template v-slot:item.sync="{ item }">
            <div class="d-flex gap-2">
                <v-icon v-if="item.sync?.twitter" color="blue" title="Synced to Twitter">mdi-twitter</v-icon>
                <v-icon v-if="item.sync?.bluesky" color="sky-blue" title="Synced to Bluesky">mdi-weather-cloudy</v-icon>
                <v-icon v-if="item.sync?.activitypub" color="purple" title="Synced to ActivityPub">mdi-earth</v-icon>
            </div>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn size="small" variant="text" icon="mdi-information" @click="viewSyncStatus(item)" title="详情"></v-btn>
          <v-btn size="small" variant="text" icon="mdi-refresh" @click="resync(item)" title="重新同步"></v-btn>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Sync Status Dialog -->
    <v-dialog v-model="dialog" max-width="600px">
        <v-card>
            <v-card-title>同步详情: #{{ selectedPost?.id }}</v-card-title>
            <v-card-text v-if="syncDetails">
                <h3>平台状态</h3>
                <v-list density="compact">
                    <v-list-item v-if="syncDetails.sync?.twitter">
                        <template v-slot:prepend><v-icon color="blue">mdi-twitter</v-icon></template>
                        <v-list-item-title>Twitter ID: {{ syncDetails.sync.twitter.id }}</v-list-item-title>
                        <v-list-item-subtitle>Type: {{ syncDetails.sync.twitter.kind }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="syncDetails.sync?.bluesky">
                         <template v-slot:prepend><v-icon color="sky-blue">mdi-weather-cloudy</v-icon></template>
                         <v-list-item-title>Bluesky URI: {{ syncDetails.sync.bluesky.uri }}</v-list-item-title>
                         <v-list-item-subtitle>CID: {{ syncDetails.sync.bluesky.cid }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="syncDetails.sync?.activitypub">
                         <template v-slot:prepend><v-icon color="purple">mdi-earth</v-icon></template>
                         <v-list-item-title>ActivityPub ID: {{ syncDetails.sync.activitypub.id }}</v-list-item-title>
                         <v-list-item-subtitle><a :href="syncDetails.sync.activitypub.url" target="_blank">查看链接</a></v-list-item-subtitle>
                    </v-list-item>
                </v-list>

                <h3 class="mt-4">投递记录 (ActivityPub)</h3>
                <v-list density="compact" style="max-height: 200px; overflow-y: auto;">
                    <v-list-item v-if="!syncDetails.delivery?.records?.length">无记录</v-list-item>
                    <v-list-item v-for="(rec, i) in syncDetails.delivery?.records" :key="i">
                        <v-list-item-title>{{ rec.inbox }}</v-list-item-title>
                        <v-list-item-subtitle>Status: {{ rec.status }} | Time: {{ rec.time }}</v-list-item-subtitle>
                    </v-list-item>
                </v-list>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="secondary" @click="pushAp(selectedPost)">仅推送到 AP</v-btn>
                <v-btn color="primary" @click="dialog = false">关闭</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import federationService from '@/services/federationService';

const posts = ref([]);
const totalPosts = ref(0);
const loading = ref(false);
const itemsPerPage = ref(10);
const activeTab = ref('all');

const dialog = ref(false);
const selectedPost = ref(null);
const syncDetails = ref(null);

const headers = [
    { title: 'ID', key: 'id' },
    { title: '作者', key: 'author.username' },
    { title: '内容', key: 'content' },
    { title: '创建时间', key: 'createdAt' },
    { title: '同步状态', key: 'sync', sortable: false },
    { title: '操作', key: 'actions', sortable: false },
];

const loadItems = async ({ page, itemsPerPage, sortBy }) => {
    loading.value = true;
    try {
        const platform = activeTab.value === 'all' ? undefined : activeTab.value;
        const res = await federationService.getFederatedPosts({
            page: page,
            limit: itemsPerPage,
            platform: platform
        });
        if (res.data.status === 'ok') {
            posts.value = res.data.data.posts;
            totalPosts.value = res.data.data.total;
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

watch(activeTab, () => {
    loadItems({ page: 1, itemsPerPage: itemsPerPage.value });
});

const viewSyncStatus = async (item) => {
    selectedPost.value = item;
    syncDetails.value = null; // Clear previous
    dialog.value = true;

    try {
        const res = await federationService.getPostSyncStatus(item.id);
        if (res.data.status === 'ok') {
            syncDetails.value = res.data.data;
        }
    } catch (e) {
        console.error(e);
    }
};

const resync = async (item) => {
    if (!confirm('确定要重新同步此帖子到所有平台吗?')) return;
    try {
        const res = await federationService.resyncPost(item.id);
        if (res.data.status === 'ok') {
            alert('已触发重新同步');
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};

const pushAp = async (item) => {
    if (!confirm('确定要仅推送到 ActivityPub 吗?')) return;
    try {
        const res = await federationService.pushPostToAp(item.id);
        if (res.data.status === 'ok') {
            alert('已触发 AP 推送');
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};
</script>
