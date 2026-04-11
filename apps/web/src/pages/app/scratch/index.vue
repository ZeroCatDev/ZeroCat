<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        <div class="text-h5 font-weight-bold mb-1">Scratch</div>
        <div class="text-body-2 text-medium-emphasis mb-5">Scratch 相关工具与资源</div>

        <v-row>
          <v-col v-for="item in items" :key="item.to" cols="12" sm="6">
            <v-card border flat hover :to="item.to">
              <v-card-item>
                <template #prepend>
                  <v-icon :icon="item.icon" />
                </template>
                <v-card-title>{{ item.label }}</v-card-title>
              </v-card-item>
              <v-card-text>{{ item.desc }}</v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useHead } from '@unhead/vue';
import { get } from '@/services/serverConfig';

useHead({ title: 'Scratch' });

const proxyEnabled = ref(false);

onMounted(() => {
  proxyEnabled.value = get('scratchproxy.enabled') || false;
});

const items = computed(() => {
  const list = [];

  if (proxyEnabled.value) {
    list.push({
      icon: 'mdi-web',
      label: 'Scratch 官网',
      desc: '通过镜像访问 Scratch 官方网站',
      to: '/app/proxy',
    });
  }

  list.push(
    {
      icon: 'mdi-download',
      label: '桌面版镜像',
      desc: '下载 Scratch 3.0 桌面版安装包',
      to: '/app/tools/asdm',
    },
    {
      icon: 'mdi-compare',
      label: '项目比较器',
      desc: '对比两个 Scratch 项目的差异',
      to: '/app/tools/comparer',
    },
    {
      icon: 'mdi-code-json',
      label: 'ScratchBlocks 转换',
      desc: '将 Scratch 文件转换为 ScratchBlocks 文本',
      to: '/app/tools/scratchblocks',
    },
    {
      icon: 'mdi-puzzle',
      label: 'Scratch 扩展',
      desc: '浏览和管理 Scratch 扩展',
      to: '/app/extensions',
    },
      {
    icon: 'mdi-database',
    label: '云变量',
    desc: 'Scratch 云变量公共服务器',
    to: '/app/docs/cloud-variables',
  },
  );

  return list;
});
</script>
