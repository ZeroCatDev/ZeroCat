<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="6">
        <div class="text-h5 font-weight-bold mb-1">02Engine</div>
        <div class="text-body-2 text-medium-emphasis mb-5">02Engine 编辑器与相关资源</div>
        <v-row>
          <v-col cols="12">
            <v-card border flat hover :to="'/02engine/index.html'">
              <v-card-item>
                <template #prepend>
                  <v-icon icon="mdi-application" />
                </template>
                <v-card-title>打开 02Engine 编辑器</v-card-title>
              </v-card-item>
              <v-card-text>进入 02Engine 编辑器页面，体验全新编辑环境。</v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card border flat hover :to="'/02engine/player.html'">
              <v-card-item>
                <template #prepend>
                  <v-icon icon="mdi-play-circle" />
                </template>
                <v-card-title>02Engine 播放器</v-card-title>
              </v-card-item>
              <v-card-text>仅用于项目播放的轻量页面。</v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { useHead } from '@unhead/vue';
useHead({ title: '02Engine' });
</script>
