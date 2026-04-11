<template>
  <v-container>
    <v-card>
      <v-card-title>
        队列管理
        <v-spacer></v-spacer>
        <v-btn icon="mdi-refresh" @click="loadStats" :loading="loading"></v-btn>
      </v-card-title>

      <v-card-text>
        <v-row>
            <v-col cols="12" md="6" v-for="q in queues" :key="q.name">
                <v-card :color="q.available ? '' : 'grey-lighten-3'" variant="outlined">
                     <v-card-title class="d-flex justify-space-between align-center">
                        {{ q.name }}
                        <v-chip v-if="!q.available" color="error">不可用</v-chip>
                        <v-chip v-else-if="q.paused" color="warning">已暂停</v-chip>
                        <v-chip v-else color="success">运行中</v-chip>
                     </v-card-title>
                     <v-card-text>
                        <v-list density="compact">
                            <v-list-item>
                                <v-list-item-title>Waiting</v-list-item-title>
                                <template v-slot:append>{{ q.waiting }}</template>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Active</v-list-item-title>
                                <template v-slot:append>{{ q.active }}</template>
                            </v-list-item>
                            <v-list-item>
                                <v-list-item-title>Completed</v-list-item-title>
                                <template v-slot:append>{{ q.completed }}</template>
                            </v-list-item>
                             <v-list-item>
                                <v-list-item-title>Failed</v-list-item-title>
                                <template v-slot:append>{{ q.failed }}</template>
                            </v-list-item>
                             <v-list-item>
                                <v-list-item-title>Delayed</v-list-item-title>
                                <template v-slot:append>{{ q.delayed }}</template>
                            </v-list-item>
                        </v-list>
                     </v-card-text>
                     <v-card-actions v-if="q.name === 'ap-federation' && q.available">
                        <v-spacer></v-spacer>
                        <v-btn
                            :color="q.paused ? 'success' : 'warning'"
                            @click="toggleQueue(q.paused ? 'resume' : 'pause')"
                        >
                            {{ q.paused ? '恢复队列' : '暂停队列' }}
                        </v-btn>
                     </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import federationService from '@/services/federationService';

const queues = ref([]);
const loading = ref(false);

const loadStats = async () => {
    loading.value = true;
    try {
        const res = await federationService.getQueueStats();
        if (res.data.status === 'ok') {
            queues.value = res.data.data.queues;
        }
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const toggleQueue = async (action) => {
    if (!confirm(`确定要 ${action === 'pause' ? '暂停' : '恢复'} AP 队列吗?`)) return;
    try {
        const res = await federationService.toggleQueue(action);
        if (res.data.status === 'ok') {
            loadStats(); // Reload to see change
        } else {
             alert('操作失败');
        }
    } catch (e) {
        console.error(e);
        alert('操作失败');
    }
};

onMounted(() => {
    loadStats();
});
</script>
