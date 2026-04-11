<template>
  <div class="posts-layout">
    <div class="posts-container">
      <UnifiedSidebar mode="twitter" class="posts-left-sidebar" />
      <main class="posts-main">
        <div class="post-analytics-page">
          <header class="analytics-header">
            <v-btn
              icon
              variant="text"
              size="small"
              class="header-back"
              @click="goBack"
            >
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <div class="header-info">
              <h1 class="header-title">帖子分析</h1>
              <p class="header-subtitle">贴文 #{{ postId }}</p>
            </div>
          </header>

          <div class="analytics-toolbar">
            <div class="range-pills">
              <button
                v-for="item in rangePresets"
                :key="item.value"
                class="range-pill"
                :class="{ 'range-pill--active': activeRangePreset === item.value }"
                @click="applyPreset(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
            <div class="range-text">{{ rangeText }}</div>
          </div>

          <div v-if="loading" class="analytics-loading">
            <v-progress-circular indeterminate color="primary" size="34" width="3" />
          </div>

          <div v-else-if="forbidden" class="analytics-empty analytics-empty--forbidden">
            <v-icon size="42">mdi-lock-outline</v-icon>
            <h2>仅作者可查看帖子分析</h2>
            <p>你没有访问该帖子的分析权限。</p>
          </div>

          <div v-else-if="loadError" class="analytics-empty">
            <v-icon size="42">mdi-alert-circle-outline</v-icon>
            <h2>加载失败</h2>
            <p>{{ loadError }}</p>
            <v-btn color="primary" variant="flat" @click="loadAnalytics">重试</v-btn>
          </div>

          <template v-else>
            <section class="overview-grid">
              <article v-for="item in overviewCards" :key="item.key" class="overview-card">
                <div class="overview-card__head">
                  <v-icon :icon="item.icon" size="18" />
                  <span>{{ item.label }}</span>
                </div>
                <div class="overview-card__value">{{ item.value }}</div>
              </article>
            </section>

            <section class="analytics-section">
              <h2 class="section-title">趋势</h2>
              <div class="chart-grid">
                <v-card rounded="xl" border class="chart-card">
                  <v-card-title class="chart-title">曝光与互动</v-card-title>
                  <v-card-text>
                    <v-chart
                      v-if="hasMainSeries"
                      :option="mainTrendOption"
                      autoresize
                      class="chart"
                    />
                    <div v-else class="chart-empty">暂无趋势数据</div>
                  </v-card-text>
                </v-card>

                <v-card rounded="xl" border class="chart-card">
                  <v-card-title class="chart-title">访客趋势</v-card-title>
                  <v-card-text>
                    <v-chart
                      v-if="hasVisitorSeries"
                      :option="visitorTrendOption"
                      autoresize
                      class="chart"
                    />
                    <div v-else class="chart-empty">暂无访客数据</div>
                  </v-card-text>
                </v-card>
              </div>
            </section>

            <section class="analytics-section">
              <h2 class="section-title">互动构成</h2>
              <v-card rounded="xl" border class="chart-card">
                <v-card-text>
                  <v-chart
                    v-if="hasBreakdown"
                    :option="breakdownOption"
                    autoresize
                    class="chart"
                  />
                  <div v-else class="chart-empty">暂无互动构成数据</div>
                </v-card-text>
              </v-card>
            </section>

            <section class="analytics-section">
              <h2 class="section-title">流量来源与受众</h2>
              <div class="table-grid">
                <v-card v-for="item in audienceTables" :key="item.key" rounded="xl" border>
                  <v-card-title class="table-title">
                    <v-icon :icon="item.icon" size="18" class="mr-2" />
                    {{ item.title }}
                  </v-card-title>
                  <v-table density="compact">
                    <tbody>
                      <tr v-for="row in item.rows" :key="`${item.key}-${row.x}`">
                        <td class="table-key">{{ row.x || '未知' }}</td>
                        <td class="table-value">{{ formatCount(row.y || 0) }}</td>
                      </tr>
                      <tr v-if="!item.rows.length">
                        <td colspan="2" class="table-empty">暂无数据</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card>
              </div>
            </section>
          </template>
        </div>
      </main>
      <HomeRightSidebar class="posts-right-sidebar" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import PostsService from '@/services/postsService';
import { showSnackbar } from '@/composables/useNotifications';
import UnifiedSidebar from '@/components/sidebar/UnifiedSidebar.vue';
import HomeRightSidebar from '@/components/home/HomeRightSidebar.vue';

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
]);

const route = useRoute();
const router = useRouter();

const postId = computed(() => route.params.id);

const rangePresets = [
  { label: '7 天', value: '7d', days: 7 },
  { label: '30 天', value: '30d', days: 30 },
  { label: '90 天', value: '90d', days: 90 },
];

const activeRangePreset = ref('30d');
const startDate = ref('');
const endDate = ref('');

const loading = ref(false);
const forbidden = ref(false);
const loadError = ref('');
const summary = ref(null);
const detail = ref(null);

const toYmd = (date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const setRangeByDays = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  startDate.value = toYmd(start);
  endDate.value = toYmd(end);
};

const formatCount = (count) => {
  const n = Number(count || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
};

const formatPercent = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(2)}%`;
};

const rangeText = computed(() => {
  if (!startDate.value || !endDate.value) return '';
  return `${startDate.value} ~ ${endDate.value}`;
});

const overview = computed(() => {
  const t = detail.value?.twitterLikeOverview || {};
  const s = summary.value || {};
  return {
    impressions: Number(t.impressions ?? s.viewCount ?? 0),
    engagements: Number(t.engagements ?? s.engagementCount ?? 0),
    engagementRate: Number(t.engagement_rate ?? s.engagementRate ?? 0),
    likes: Number(t.likes ?? s.likeCount ?? 0),
    replies: Number(t.replies ?? s.replyCount ?? 0),
    repostsAndQuotes: Number(t.reposts ?? s.retweetCount ?? 0) + Number(t.quotes ?? s.quoteCount ?? 0),
  };
});

const overviewCards = computed(() => [
  { key: 'impressions', label: '曝光', icon: 'mdi-poll', value: formatCount(overview.value.impressions) },
  { key: 'engagements', label: '互动', icon: 'mdi-gesture-tap', value: formatCount(overview.value.engagements) },
  { key: 'rate', label: '互动率', icon: 'mdi-percent-outline', value: formatPercent(overview.value.engagementRate) },
  { key: 'likes', label: '点赞', icon: 'mdi-heart-outline', value: formatCount(overview.value.likes) },
  { key: 'replies', label: '回复', icon: 'mdi-chat-outline', value: formatCount(overview.value.replies) },
  { key: 'reposts', label: '转发/引用', icon: 'mdi-repeat-variant', value: formatCount(overview.value.repostsAndQuotes) },
]);

const seriesData = computed(() => detail.value?.twitterLikeTimeseries || { impressions: [], visitors: [], engagements: [] });

const xAxisLabels = computed(() => {
  const source = seriesData.value.impressions?.length
    ? seriesData.value.impressions
    : seriesData.value.engagements;
  return (source || []).map((item) => item.x);
});

const hasMainSeries = computed(() => {
  return (seriesData.value.impressions?.length || 0) > 0 || (seriesData.value.engagements?.length || 0) > 0;
});

const hasVisitorSeries = computed(() => {
  return (seriesData.value.visitors?.length || 0) > 0;
});

const hasBreakdown = computed(() => {
  const b = detail.value?.engagementBreakdown || {};
  return Number(b.likes || 0) + Number(b.replies || 0) + Number(b.reposts || 0) + Number(b.quotes || 0) + Number(b.bookmarks || 0) > 0;
});

const mainTrendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['曝光', '互动'] },
  grid: { left: 20, right: 20, top: 32, bottom: 20, containLabel: true },
  xAxis: { type: 'category', data: xAxisLabels.value },
  yAxis: { type: 'value' },
  series: [
    {
      name: '曝光',
      type: 'line',
      smooth: true,
      data: (seriesData.value.impressions || []).map((item) => item.y),
      lineStyle: { width: 2 },
      symbolSize: 6,
    },
    {
      name: '互动',
      type: 'line',
      smooth: true,
      data: (seriesData.value.engagements || []).map((item) => item.y),
      lineStyle: { width: 2 },
      symbolSize: 6,
    },
  ],
}));

const visitorTrendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['访客'] },
  grid: { left: 20, right: 20, top: 32, bottom: 20, containLabel: true },
  xAxis: { type: 'category', data: (seriesData.value.visitors || []).map((item) => item.x) },
  yAxis: { type: 'value' },
  series: [
    {
      name: '访客',
      type: 'line',
      smooth: true,
      areaStyle: { opacity: 0.12 },
      data: (seriesData.value.visitors || []).map((item) => item.y),
      lineStyle: { width: 2 },
      symbolSize: 5,
    },
  ],
}));

const breakdownOption = computed(() => {
  const b = detail.value?.engagementBreakdown || {};
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 20, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: ['点赞', '回复', '转发', '引用', '收藏'],
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        data: [
          Number(b.likes || 0),
          Number(b.replies || 0),
          Number(b.reposts || 0),
          Number(b.quotes || 0),
          Number(b.bookmarks || 0),
        ],
      },
    ],
  };
});

const audienceTables = computed(() => {
  const top = (arr) => (Array.isArray(arr) ? arr.slice(0, 8) : []);
  return [
    { key: 'referrers', title: '来源站点', icon: 'mdi-link-variant', rows: top(detail.value?.referrers) },
    { key: 'browsers', title: '浏览器', icon: 'mdi-web', rows: top(detail.value?.browsers) },
    { key: 'os', title: '操作系统', icon: 'mdi-laptop', rows: top(detail.value?.os) },
    { key: 'devices', title: '设备类型', icon: 'mdi-cellphone-link', rows: top(detail.value?.devices) },
    { key: 'countries', title: '国家/地区', icon: 'mdi-earth', rows: top(detail.value?.countries) },
  ];
});

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push(`/app/posts/${postId.value}`);
};

const loadAnalytics = async () => {
  if (!postId.value) return;
  loading.value = true;
  forbidden.value = false;
  loadError.value = '';

  try {
    const [summaryRes, detailRes] = await Promise.all([
      PostsService.getAnalytics(postId.value),
      PostsService.getAnalyticsViews(postId.value, {
        startDate: startDate.value,
        endDate: endDate.value,
      }),
    ]);

    summary.value = summaryRes;
    detail.value = detailRes;
  } catch (error) {
    if (error?.status === 403) {
      forbidden.value = true;
    } else {
      loadError.value = error?.message || '加载帖子分析失败';
      showSnackbar(loadError.value, 'error');
    }
  } finally {
    loading.value = false;
  }
};

const applyPreset = async (preset) => {
  const selected = rangePresets.find((item) => item.value === preset) || rangePresets[1];
  activeRangePreset.value = selected.value;
  setRangeByDays(selected.days);
  await loadAnalytics();
};

onMounted(async () => {
  setRangeByDays(30);
  await loadAnalytics();
});
</script>

<style scoped>
.post-analytics-page {
  width: 100%;
  min-height: 100vh;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.posts-layout {
  min-height: 100vh;
}

.posts-container {
  display: flex;
  justify-content: center;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}

.posts-left-sidebar {
  width: 275px;
  flex-shrink: 0;
}

.posts-main {
  width: 100%;
  max-width: 600px;
  flex-shrink: 0;
}

.posts-right-sidebar {
  width: 350px;
  flex-shrink: 0;
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .posts-left-sidebar { width: 88px; }
  .posts-main { max-width: 600px; }
  .posts-right-sidebar { display: none; }
}

@media (max-width: 1023px) {
  .posts-container { padding: 0; }
  .posts-left-sidebar { display: none; }
  .posts-main { max-width: 100%; }
  .posts-right-sidebar { display: none; }
}

.analytics-header {
  position: sticky;
  top: 64px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px;
  background: rgba(var(--v-theme-surface), 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.header-title {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.1;
}

.header-subtitle {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.analytics-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.range-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.range-pill {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  background: rgba(var(--v-theme-surface), 1);
  color: rgba(var(--v-theme-on-surface), 0.8);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  cursor: pointer;
}

.range-pill--active {
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.45);
  background: rgba(var(--v-theme-primary), 0.08);
}

.range-text {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.analytics-loading,
.analytics-empty {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 24px;
}

.analytics-empty h2 {
  font-size: 20px;
  font-weight: 700;
}

.analytics-empty p {
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 16px;
}

.overview-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  padding: 12px;
  background: rgba(var(--v-theme-surface), 1);
}

.overview-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.62);
}

.overview-card__value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 800;
}

.analytics-section {
  padding: 6px 16px 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 10px;
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.chart-card {
  overflow: hidden;
}

.chart-title {
  font-size: 15px;
  font-weight: 700;
  padding-bottom: 0;
}

.chart {
  height: 260px;
}

.chart-empty {
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.table-grid {
  display: grid;
  gap: 12px;
}

.table-title {
  font-size: 15px;
  font-weight: 700;
  padding-bottom: 0;
}

.table-key {
  color: rgba(var(--v-theme-on-surface), 0.86);
}

.table-value {
  text-align: right;
  font-weight: 600;
}

.table-empty {
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.58);
  padding: 14px 0;
}
</style>
