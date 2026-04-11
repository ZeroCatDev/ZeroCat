<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        <div class="text-h5 font-weight-bold mb-1">云服务</div>
        <div class="text-body-2 text-medium-emphasis mb-5">平台提供的在线服务</div>

        <v-row>
          <v-col v-for="item in items" :key="item.to" cols="12" sm="6">
            <v-card border flat hover :to="item.to" :href="item.href" :target="item.href ? '_blank' : undefined">
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
import { useHead } from '@unhead/vue';

useHead({ title: '云服务' });

const items = [
  {
    icon: 'mdi-comment-multiple-outline',
    label: 'Waline 评论空间',
    desc: '管理和配置评论服务',
    to: '/app/commentservice',
  },
  {
    icon: 'mdi-translate',
    label: '翻译',
    desc: '在线翻译工具',
    to: '/app/translate',
  },
  {
    icon: 'mdi-database',
    label: '云变量',
    desc: 'Scratch 云变量公共服务器',
    to: '/app/docs/cloud-variables',
  },
  {
    icon: 'mdi-database',
    label: 'Classworks KV',
    desc: 'Classworks KV 云变量服务器',
    href: 'https://kv.houlang.cloud',
  },
  {
    icon: 'mdi-account',
    label: 'OAuth',
    desc: 'ZeroCat OAuth',
    to: '/app/oauth/applications',
  }
];
</script>
