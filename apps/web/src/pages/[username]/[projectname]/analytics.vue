<template>
  <v-container>
    <!-- Header -->
    <div class="analytics-header">
      <div>
        <h1 class="analytics-title">数据分析</h1>
        <p class="analytics-subtitle">{{ project.title || '加载中...' }}</p>
      </div>
      <v-select
        v-model="timeRange"
        :items="timeRanges"
        density="compact"
        hide-details
        variant="outlined"
        rounded="lg"
        style="max-width: 200px"
      />
    </div>

    <!-- Overview Cards -->
    <div class="overview-grid">
      <div class="overview-card" v-for="item in overviewItems" :key="item.label">
        <div class="overview-card__inner">
          <div class="overview-card__icon">
            <v-icon :icon="item.icon" size="22" />
          </div>
          <div class="overview-card__content">
            <span class="overview-card__label">{{ item.label }}</span>
            <span class="overview-card__value">{{ item.value }}</span>
          </div>
          <v-chip
            :color="item.growthColor"
            size="small"
            variant="tonal"
            class="overview-card__growth"
          >
            <v-icon
              :icon="item.growth >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'"
              size="14"
              start
            />
            {{ item.growth }}%
          </v-chip>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <v-card border rounded="xl" class="mt-6">
      <v-card-text class="pa-6">
        <div class="text-h6 mb-4">访问趋势</div>
        <v-chart
          v-if="analytics?.timeseries?.pageviews?.length > 0"
          :option="chartOption"
          autoresize
          class="chart"
        />
        <div v-else class="d-flex justify-center align-center chart">
          <v-progress-circular color="primary" indeterminate />
        </div>
      </v-card-text>
    </v-card>

    <!-- Statistics Tables - Row 1 -->
    <div class="tables-grid mt-6">
      <v-card border rounded="xl">
        <v-card-text class="pa-5">
          <div class="table-header">
            <v-icon icon="mdi-link-variant" size="20" class="table-header__icon" />
            <span class="text-subtitle-1 font-weight-medium">来源域名</span>
          </div>
          <v-table density="compact" class="mt-3">
            <thead>
              <tr>
                <th>域名</th>
                <th class="text-right">访问次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in analytics?.referrers || []" :key="index">
                <td>{{ item?.x || '直接访问' }}</td>
                <td class="text-right">
                  <span class="font-weight-medium">{{ item?.y || 0 }}</span>
                </td>
              </tr>
              <tr v-if="!analytics?.referrers?.length">
                <td class="text-center text-medium-emphasis" colspan="2">暂无数据</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <v-card border rounded="xl">
        <v-card-text class="pa-5">
          <div class="table-header">
            <v-icon icon="mdi-web" size="20" class="table-header__icon" />
            <span class="text-subtitle-1 font-weight-medium">浏览器</span>
          </div>
          <v-table density="compact" class="mt-3">
            <thead>
              <tr>
                <th>浏览器</th>
                <th class="text-right">使用次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in analytics?.browsers || []" :key="index">
                <td>{{ formatBrowserName(item?.x) || '未知' }}</td>
                <td class="text-right">
                  <span class="font-weight-medium">{{ item?.y || 0 }}</span>
                </td>
              </tr>
              <tr v-if="!analytics?.browsers?.length">
                <td class="text-center text-medium-emphasis" colspan="2">暂无数据</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <v-card border rounded="xl">
        <v-card-text class="pa-5">
          <div class="table-header">
            <v-icon icon="mdi-monitor" size="20" class="table-header__icon" />
            <span class="text-subtitle-1 font-weight-medium">操作系统</span>
          </div>
          <v-table density="compact" class="mt-3">
            <thead>
              <tr>
                <th>系统</th>
                <th class="text-right">使用次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in analytics?.os || []" :key="index">
                <td>{{ item?.x || '未知' }}</td>
                <td class="text-right">
                  <span class="font-weight-medium">{{ item?.y || 0 }}</span>
                </td>
              </tr>
              <tr v-if="!analytics?.os?.length">
                <td class="text-center text-medium-emphasis" colspan="2">暂无数据</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </div>

    <!-- Statistics Tables - Row 2 -->
    <div class="tables-grid tables-grid--half mt-6">
      <v-card border rounded="xl">
        <v-card-text class="pa-5">
          <div class="table-header">
            <v-icon icon="mdi-cellphone-link" size="20" class="table-header__icon" />
            <span class="text-subtitle-1 font-weight-medium">设备类型</span>
          </div>
          <v-table density="compact" class="mt-3">
            <thead>
              <tr>
                <th>类型</th>
                <th class="text-right">使用次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in analytics?.devices || []" :key="index">
                <td>{{ formatDeviceType(item?.x) || '未知' }}</td>
                <td class="text-right">
                  <span class="font-weight-medium">{{ item?.y || 0 }}</span>
                </td>
              </tr>
              <tr v-if="!analytics?.devices?.length">
                <td class="text-center text-medium-emphasis" colspan="2">暂无数据</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <v-card border rounded="xl">
        <v-card-text class="pa-5">
          <div class="table-header">
            <v-icon icon="mdi-earth" size="20" class="table-header__icon" />
            <span class="text-subtitle-1 font-weight-medium">国家/地区</span>
          </div>
          <v-table density="compact" class="mt-3">
            <thead>
              <tr>
                <th>国家/地区</th>
                <th class="text-right">访问次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in analytics?.countries || []" :key="index">
                <td>{{ formatCountryName(item?.x) || '未知' }}</td>
                <td class="text-right">
                  <span class="font-weight-medium">{{ item?.y || 0 }}</span>
                </td>
              </tr>
              <tr v-if="!analytics?.countries?.length">
                <td class="text-center text-medium-emphasis" colspan="2">暂无数据</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<script>
import {use404Helper} from '@/composables/use404';
import {use} from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';
import {BarChart} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import {getProjectAnalytics, getProjectInfoByNamespace} from '@/services/projectService';

use([
  CanvasRenderer,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
]);

export default {
  components: {
    VChart,
  },
  data() {
    return {
      project: {
        id: null,
      },
      analytics: {
        overview: {
          pageviews: {value: 0, prev: 0},
          visitors: {value: 0, prev: 0},
          visits: {value: 0, prev: 0},
          bounces: {value: 0, prev: 0},
          totaltime: {value: 0, prev: 0}
        },
        referrers: [],
        browsers: [],
        os: [],
        devices: [],
        countries: [],
        timeseries: {
          pageviews: [],
          sessions: [],
        },
      },
      timeRange: '24h',
      timeRanges: [
        {title: '最近 24 小时', value: '24h'},
        {title: '最近 7 天', value: '7d'},
        {title: '最近 30 天', value: '30d'},
        {title: '本月', value: 'this-month'},
        {title: '上月', value: 'last-month'},
      ],
    };
  },
  computed: {
    overviewItems() {
      const o = this.analytics?.overview;
      return [
        {
          label: '浏览量',
          value: o?.pageviews?.value || 0,
          icon: 'mdi-poll',
          growth: this.calculateGrowth(o?.pageviews?.value, o?.pageviews?.prev),
          growthColor: this.getGrowthColor(o?.pageviews?.value, o?.pageviews?.prev),
        },
        {
          label: '访客数',
          value: o?.visitors?.value || 0,
          icon: 'mdi-account-outline',
          growth: this.calculateGrowth(o?.visitors?.value, o?.visitors?.prev),
          growthColor: this.getGrowthColor(o?.visitors?.value, o?.visitors?.prev),
        },
        {
          label: '访问次数',
          value: o?.visits?.value || 0,
          icon: 'mdi-cursor-default-click-outline',
          growth: this.calculateGrowth(o?.visits?.value, o?.visits?.prev),
          growthColor: this.getGrowthColor(o?.visits?.value, o?.visits?.prev),
        },
        {
          label: '跳出率',
          value: this.calculateBounceRate(o?.bounces?.value, o?.visits?.value) + '%',
          icon: 'mdi-exit-run',
          growth: this.calculateGrowth(o?.bounces?.value, o?.bounces?.prev),
          growthColor: this.getGrowthColor(o?.bounces?.value, o?.bounces?.prev, true),
        },
      ];
    },
    chartOption() {
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          },
          formatter: (params) => {
            const date = new Date(params[0].axisValue);
            const formattedDate = this.formatDate(date);
            let result = `${formattedDate}<br/>`;
            params.reverse().forEach(param => {
              result += `${param.seriesName}: ${param.value}<br/>`;
            });
            return result;
          }
        },
        legend: {
          data: ['浏览量', '访客数']
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: this.analytics.timeseries.pageviews.map(item => item.x),
          axisLabel: {
            formatter: (value) => {
              const date = new Date(value);
              if (this.timeRange === '24h') {
                return `${date.getHours()}:00`;
              } else {
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }
            }
          }
        },
        yAxis: {
          type: 'value'
        },
        series: [
          {
            name: '访客数',
            type: 'bar',
            data: this.analytics.timeseries.sessions.map(item => item.y),
            itemStyle: {
              color: 'rgb(25, 118, 210)',
              borderRadius: [4, 4, 0, 0],
            },
            barGap: '-100%',
            barWidth: '60%',
            z: 1
          },
          {
            name: '浏览量',
            type: 'bar',
            data: this.analytics.timeseries.pageviews.map(item => item.y),
            itemStyle: {
              color: 'rgba(25, 118, 210, 0.3)',
              borderRadius: [4, 4, 0, 0],
            },
            barWidth: '60%',
            z: 2
          }
        ]
      };
    },
  },
  methods: {
    getDateRange(range) {
      const now = new Date();
      let endDate = new Date(now);
      let startDate = new Date(now);

      switch (range) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'this-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default:
          startDate.setHours(startDate.getHours() - 24);
      }

      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };
    },
    async initializeProject() {
      try {
        const username = this.$route.params.username;
        const projectname = this.$route.params.projectname;

        const projectInfo = await getProjectInfoByNamespace(username, projectname);
        if (!projectInfo || projectInfo.id === 0) {
          use404Helper.show404();
          return;
        }

        this.project = projectInfo;
        await this.fetchAnalytics();
      } catch (error) {
        console.error('Failed to initialize project:', error);
        use404Helper.show404();
      }
    },
    async fetchAnalytics() {
      try {
        const projectId = this.project?.id;
        if (!projectId) return;

        const {startDate, endDate} = this.getDateRange(this.timeRange);
        const response = await getProjectAnalytics(projectId, startDate, endDate);
        if (response.status === 'success') {
          this.analytics = response.data;
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    },
    calculateGrowth(current, previous) {
      if (!previous) return 0;
      return Math.round(((current - previous) / previous) * 100);
    },
    getGrowthColor(current, previous, inverse = false) {
      if (!previous) return 'grey';
      const growth = this.calculateGrowth(current, previous);
      const isPositive = growth > 0;
      return inverse ? (!isPositive ? 'success' : 'error') : (isPositive ? 'success' : 'error');
    },
    calculateBounceRate(bounces, visits) {
      if (!visits) return 0;
      return Math.round((bounces / visits) * 100);
    },
    formatBrowserName(name) {
      const names = {
        'edge-chromium': 'Edge',
        'chrome': 'Chrome',
      };
      return names[name] || name;
    },
    formatDeviceType(type) {
      const types = {
        'desktop': '桌面端',
        'mobile': '移动端',
        'tablet': '平板',
      };
      return types[type] || type;
    },
    formatCountryName(code) {
      const countries = {
        'HK': '中国香港',
        'CN': '中国大陆',
        'US': '美国',
      };
      return countries[code] || code;
    },
    formatDate(date) {
      if (this.timeRange === '24h') {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:00`;
      } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    },
  },
  async mounted() {
    await this.initializeProject();
  },
  watch: {
    timeRange: {
      handler() {
        this.fetchAnalytics();
      },
    },
  },
};
</script>

<style scoped>
.analytics-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.analytics-title {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.015em;
  margin: 0;
}
.analytics-subtitle {
  font-size: 0.95rem;
  opacity: 0.55;
  margin: 4px 0 0 0;
}

/* Overview Cards */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 959px) {
  .overview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 599px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
.overview-card__inner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  transition: border-color 0.15s;
}
.overview-card__inner:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}
.overview-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
.overview-card__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.overview-card__label {
  font-size: 0.85rem;
  opacity: 0.55;
  line-height: 1.3;
}
.overview-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.overview-card__growth {
  flex-shrink: 0;
  margin-top: 2px;
}

/* Chart */
.chart {
  height: 400px;
}

/* Tables */
.tables-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.tables-grid--half {
  grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 959px) {
  .tables-grid,
  .tables-grid--half {
    grid-template-columns: 1fr;
  }
}
.table-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-header__icon {
  opacity: 0.6;
}
</style>
