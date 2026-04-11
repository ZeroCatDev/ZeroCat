<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
          <h1>云变量信息</h1>
          <div class="d-flex ga-2">
            <v-btn
              size="small"
              variant="tonal"
              :disabled="loading || !isLogin"
              @click="refreshIncremental"
            >
              刷新
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              :to="projectLink"
            >
              返回作品
            </v-btn>
          </div>
        </div>
      </v-col>

      <v-col cols="12" v-if="!isLogin">
        <v-alert type="info" variant="tonal">
          登录后可查看云变量历史记录。
          <div class="mt-3">
            <v-btn color="primary" size="small" to="/app/account/login">
              去登录
            </v-btn>
          </div>
        </v-alert>
      </v-col>

      <v-col cols="12" v-else>
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>云变量历史</span>
            <v-chip size="small" variant="tonal" color="primary">
              {{ historyRows.length }} 条
            </v-chip>
          </v-card-title>
          <v-card-subtitle class="pt-1">
            项目 ID: {{ project.id || '-' }}
          </v-card-subtitle>
          <v-card-text>
            <v-alert
              v-if="errorMessage"
              class="mb-3"
              density="compact"
              type="warning"
              variant="tonal"
            >
              {{ errorMessage }}
            </v-alert>

            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">操作</th>
                  <th class="text-left">变量名</th>
                  <th class="text-left">值</th>
                  <th class="text-left">用户</th>
                  <th class="text-left">IP</th>
                  <th class="text-left">创建时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in historyRows" :key="item._key">
                  <td>{{ item.method || '-' }}</td>
                  <td>{{ item.name || '-' }}</td>
                  <td class="value-cell">{{ item.value ?? '-' }}</td>
                  <td>
                    <router-link
                      v-if="getActorUsername(item)"
                      class="user-link"
                      :to="`/${getActorUsername(item)}`"
                    >
                      {{ getActorDisplay(item) }}
                    </router-link>
                    <span v-else>{{ getActorDisplay(item) }}</span>
                  </td>
                  <td>{{ item.ip || '-' }}</td>
                  <td>{{ formatTime(item.created_at) }}</td>
                </tr>
                <tr v-if="!historyRows.length && !loading">
                  <td colspan="6" class="text-medium-emphasis">暂无历史记录</td>
                </tr>
              </tbody>
            </v-table>

            <div class="d-flex justify-center mt-4">
              <v-btn
                :disabled="loadingMore || !hasMore"
                :loading="loadingMore"
                size="small"
                variant="tonal"
                @click="loadMore"
              >
                加载更多
              </v-btn>
            </div>
          </v-card-text><br/><br/><br/>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import request from "@/axios/axios";
import { localuser } from "@/services/localAccount";
import { useHead } from "@unhead/vue";
import { use404Helper } from "@/composables/use404";
import { getProjectInfoByNamespace } from "@/services/projectService";

const PAGE_LIMIT = 50;

export default {
  name: "CloudVariablesHistoryPage",
  setup() {
    useHead({ title: "云变量信息" });
    return {};
  },
  data() {
    return {
      localuser,
      project: {},
      history: [],
      nextSince: 0,
      loading: false,
      loadingMore: false,
      hasMore: true,
      errorMessage: "",
    };
  },
  computed: {
    isLogin() {
      return localuser.isLogin.value;
    },
    historyRows() {
      return this.history.map((item, index) => ({
        ...item,
        _key: item?.id ?? `${item?.created_at || "row"}-${index}`,
      }));
    },
    projectLink() {
      return `/${this.$route.params.username}/${this.$route.params.projectname}`;
    },
  },
  async created() {
    await this.initProject();
    if (this.isLogin) {
      this.loadHistory({ reset: true });
    }
  },
  mounted() {
    window.addEventListener("cloudVariableUpdated", this.handleCloudUpdate);
  },
  beforeUnmount() {
    window.removeEventListener("cloudVariableUpdated", this.handleCloudUpdate);
  },
  watch: {
    isLogin(newVal) {
      if (newVal && this.project?.id) {
        this.loadHistory({ reset: true });
      }
    },
  },
  methods: {
    async initProject() {
      const username = this.$route.params.username;
      const projectname = this.$route.params.projectname;
      try {
        const projectFromCloud = await getProjectInfoByNamespace(
          username,
          projectname
        );
        if (projectFromCloud.id === 0) {
          use404Helper.show404();
          return;
        }
        this.project = projectFromCloud;
      } catch (error) {
        use404Helper.show404();
      }
    },
    async loadHistory({ reset }) {
      if (!this.project?.id) return;
      if (reset) {
        this.loading = true;
        this.history = [];
        this.nextSince = 0;
        this.hasMore = true;
      } else {
        this.loadingMore = true;
      }
      this.errorMessage = "";
      try {
        const since = reset ? 0 : this.nextSince || 0;
        const res = await request.get(
          `/scratch/cloud/${this.project.id}/history`,
          {
            params: {
              since,
              limit: PAGE_LIMIT,
            },
          }
        );
        const payload = res?.data ?? {};
        const list = this.extractList(payload);
        const nextSince = this.extractNextSince(payload);
        this.appendHistory(list);
        if (typeof nextSince === "number") {
          this.nextSince = nextSince;
        }
        this.hasMore = list.length >= PAGE_LIMIT;
      } catch (error) {
        this.errorMessage = error?.message || "加载历史失败";
        this.hasMore = false;
      } finally {
        this.loading = false;
        this.loadingMore = false;
      }
    },
    loadMore() {
      if (this.loading || this.loadingMore || !this.hasMore) return;
      this.loadHistory({ reset: false });
    },
    refreshIncremental() {
      if (this.loading || this.loadingMore) return;
      this.loadHistory({ reset: false });
    },
    handleCloudUpdate(event) {
      const projectId = event?.detail?.projectId;
      if (!projectId || Number(projectId) !== Number(this.project?.id)) return;
      this.refreshIncremental();
    },
    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.history)) return payload.history;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    },
    extractNextSince(payload) {
      if (typeof payload?.next_since === "number") return payload.next_since;
      if (typeof payload?.nextSince === "number") return payload.nextSince;
      return null;
    },
    appendHistory(list) {
      if (!Array.isArray(list) || list.length === 0) return;
      const existingIds = new Set(this.history.map((item) => item?.id));
      list.forEach((item) => {
        if (item?.id != null && existingIds.has(item.id)) return;
        this.history.push(item);
      });
    },
    getActorUsername(item) {
      return item?.actor?.username || null;
    },
    getActorDisplay(item) {
      if (item?.actor?.display_name && item?.actor?.username) {
        return `${item.actor.display_name}（${item.actor.username}）`;
      }
      if (item?.actor?.display_name) return item.actor.display_name;
      if (item?.actor?.username) return item.actor.username;
      if (item?.actor_name) return item.actor_name;
      if (item?.actor) return item.actor;
      if (item?.actor_id != null) return String(item.actor_id);
      return "-";
    },
    formatTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString();
    },
  },
};
</script>

<style scoped>
.value-cell {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-link {
  color: inherit;
  text-decoration: underline;
}
</style>
