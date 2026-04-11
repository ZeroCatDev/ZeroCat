<template>
  <v-container>
    <v-card class="mb-6">
      <v-card-title>联邦系统概览</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-alert
              v-if="stats.federation"
              :type="stats.federation.enabled ? 'success' : 'warning'"
              variant="tonal"
              border="start"
            >
              <div class="text-h6">ActivityPub 状态</div>
              <div>域名: {{ stats.federation.domain }}</div>
              <div>状态: {{ stats.federation.enabled ? '已启用' : '未启用' }}</div>
            </v-alert>
          </v-col>
          <v-col cols="12" md="6" v-if="stats.queue">
             <v-card variant="outlined">
                <v-card-title>队列状态</v-card-title>
                <v-card-text>
                    <div class="d-flex justify-space-between">
                         <span>等待中: {{ stats.queue.waiting }}</span>
                         <span>进行中: {{ stats.queue.active }}</span>
                         <span>已完成: {{ stats.queue.completed }}</span>
                         <span>失败: {{ stats.queue.failed }}</span>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-btn color="primary" to="/app/admin/federation/queue">管理队列</v-btn>
                </v-card-actions>
             </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-row>
        <v-col cols="12" sm="6" md="3" v-for="(count, key) in displayCounts" :key="key">
            <v-card>
                <v-card-text class="d-flex flex-column align-center">
                    <div class="text-h4 mb-2">{{ count.value }}</div>
                    <div class="text-subtitle-1">{{ count.label }}</div>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <v-row class="mt-4" v-if="stats.platformSync">
        <v-col cols="12">
            <v-card>
                <v-card-title>平台同步统计</v-card-title>
                <v-card-text>
                     <v-row>
                        <v-col cols="12" md="4" v-for="(count, platform) in stats.platformSync" :key="platform">
                             <v-list-item>
                                <template v-slot:prepend>
                                    <v-icon :icon="getPlatformIcon(platform)"></v-icon>
                                </template>
                                <v-list-item-title class="text-capitalize">{{ platform }}</v-list-item-title>
                                <template v-slot:append>
                                    <v-chip>{{ count }}</v-chip>
                                </template>
                             </v-list-item>
                        </v-col>
                     </v-row>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>

    <v-row class="mt-4">
        <v-col cols="12">
            <div class="d-flex gap-2 flex-wrap">
                <v-btn prepend-icon="mdi-account-group" to="/app/admin/federation/users" color="primary" variant="tonal">本地联邦用户</v-btn>
                <v-btn prepend-icon="mdi-account-network" to="/app/admin/federation/proxy-users" color="secondary" variant="tonal">远程代理用户</v-btn>
                <v-btn prepend-icon="mdi-sync" to="/app/admin/federation/posts" color="info" variant="tonal">帖子同步管理</v-btn>
            </div>
        </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import federationService from '@/services/federationService';

const stats = ref({
    federation: null,
    counts: {},
    platformSync: null,
    queue: null
});

const displayCounts = computed(() => {
    const c = stats.value.counts || {};
    return [
        { key: 'remoteFollowers', label: '远程关注者', value: c.remoteFollowers || 0 },
        { key: 'proxyUsers', label: '远程代理用户', value: c.proxyUsers || 0 },
        { key: 'federatedPosts', label: '联邦帖子', value: c.federatedPosts || 0 },
        { key: 'localPosts', label: '本地帖子', value: c.localPosts || 0 },
    ];
});

const getPlatformIcon = (platform) => {
    switch(platform) {
        case 'twitter': return 'mdi-twitter';
        case 'bluesky': return 'mdi-butterfly'; // Assuming mdi-butterfly or similar, or just cloud
        case 'activitypub': return 'mdi-earth';
        default: return 'mdi-share-variant';
    }
};

const loadStats = async () => {
    try {
        const res = await federationService.getStats();
        if (res.status === 200 && res.data.status === 'ok') {
            stats.value = res.data.data;
        }
    } catch (e) {
        console.error('Failed to load federation stats', e);
    }
};

onMounted(() => {
    loadStats();
});
</script>
