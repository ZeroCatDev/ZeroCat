<template>
  <v-container>
    <!-- 页面标题 -->

        <v-card  class="mb-4" border><v-card-item prepend-icon="mdi-puzzle" >
          <v-card-title>

            扩展市场
          </v-card-title>
          <v-card-subtitle>
            发现和使用社区开发的扩展来增强您的项目功能
          </v-card-subtitle>
        </v-card-item>
        <v-card-actions>
          <v-btn to="/app/extensions/my">
            我的扩展
          </v-btn>
        </v-card-actions>
        </v-card>





        <!-- 空状态 -->
        <v-row>
          <v-col cols="12" class="text-center py-16">
            <v-icon size="80" color="grey-lighten-1">mdi-puzzle-outline</v-icon>
            <h2 class="text-h5 mt-4 text-grey-darken-1">单独的扩展市场已经下架</h2>
            <p class="text-body-1 text-grey mt-2">
             扩展市场已经下架，请在项目页面选择Scratch扩展类型以查看
            </p>

          </v-col>
        </v-row>




  </v-container>
</template>

<script>
import { useHead } from "@unhead/vue";
import request from "@/axios/axios";
import { get } from "@/services/serverConfig";
import ExtensionCard from "@/components/extensions/ExtensionCard.vue";

export default {
  name: "ExtensionsMarket",
  components: {
    ExtensionCard
  },
  setup() {
    useHead({
      title: "扩展市场 - ZeroCat",
    });
  },
  data() {
    return {

    };
  },

};
</script>
