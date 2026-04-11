<template>
  <v-dialog
    :model-value="modelValue"
    max-width="800px"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-item>
        <v-card-title class="headline">
          编辑用户信息

        </v-card-title>
        <v-card-subtitle>
          <v-icon>mdi-account</v-icon>
          {{ userData.username }}
        </v-card-subtitle>
        <template v-slot:append>
          <v-btn icon @click="close">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-card-item>
      <v-divider></v-divider>

      <v-card-text class="pt-4">
        <v-form ref="editForm" v-model="formValid">
          <v-tabs
            :model-value="tabIndex"
            @update:model-value="onTabChange"

          >
            <!-- <v-tab :value="0">基本信息</v-tab> -->
            <v-tab :value="1">个人资料</v-tab>
            <v-tab :value="2">账户连接</v-tab>
            <v-tab :value="3">头像设置</v-tab>
            <v-tab :value="4">数据</v-tab>
            <v-tab v-if="isCurrentUserAdmin" :value="5">ow_target_config 调试器</v-tab>
          </v-tabs>

          <v-card-text>
            <v-window
              :model-value="tabIndex"
              @update:model-value="onTabChange"
            >
              <!-- 基本信息标签页 -->
              <v-window-item :value="0">
                <v-container>
                  <v-row></v-row>
                </v-container>
              </v-window-item>

              <!-- 个人资料标签页 -->
              <v-window-item :value="1">
                <v-container
                >
                  <v-row>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.display_name"
                        :rules="[(v) => !!v || '显示名称不能为空']"
                        dense
                        label="显示名称"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.username"
                        dense

                        label="用户名"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="userData.status"
                        :items="statusOptions"
                        dense
                        item-title="text"
                        item-value="value"
                        label="用户状态"
                        outlined
                      ></v-select>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="userData.type"
                        :items="typeOptions"
                        dense
                        item-title="text"
                        item-value="value"
                        label="用户类型"
                        outlined
                      ></v-select>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.email"
                        dense
                        label="邮箱"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <ProjectSelector
                        v-model="userData.featured_projects"
                        :multiple="false"
                        :author="userData.id"
                      />
                      <v-text-field
                        v-model="userData.featured_projects"
                        dense
                        label="精选项目"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.bio"
                        dense
                        label="一句话简介"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.location"
                        dense
                        label="位置"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        :model-value="selectedRegion ? selectedRegion.text : ''"
                        dense
                        label="地区"
                        outlined
                        readonly
                        @click="showRegionSelector = true"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.url"
                        dense
                        label="个人主页"
                        outlined
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="userData.sex"
                        :items="sexOptions"
                        dense
                        item-title="text"
                        item-value="value"
                        label="性别"
                        outlined
                      ></v-select>
                    </v-col>
                    <!-- <v-col cols="12" sm="6">
                      <v-text-field
                        v-model="userData.birthday"
                        label="生日"
                        type="date"
                        outlined
                        dense
                      ></v-text-field>
                    </v-col> -->
                    <v-col cols="12">
                      <v-textarea
                        v-model="userData.bio"
                        dense
                        hint="支持 Markdown 格式"
                        label="个人简介"
                        outlined
                        persistent-hint
                        rows="3"
                      ></v-textarea>
                    </v-col>
                  </v-row>
                </v-container>
              </v-window-item>

              <!-- 账户连接标签页 -->
              <v-window-item :value="2">
                <v-container>
                  <v-row>
                    <v-col cols="12">
                      <div class="d-flex align-center mb-4">
                        <h3 class="text-h6">连接</h3>
                        <v-spacer></v-spacer>
                        <v-btn
                          color="primary"
                          prepend-icon="mdi-plus"
                          @click="showAddConnectionDialog"
                        >
                          添加连接
                        </v-btn>
                      </div>

                      <v-data-table
                        :headers="connectionHeaders"
                        :items="connections"
                        :loading="loadingConnections"
                        class="elevation-1"
                      >
                        <!-- 连接类型列 -->
                        <template v-slot:item.contact_type="{ item }">
                          <v-chip
                            :color="getConnectionTypeColor(item.contact_type)"
                            size="small"
                          >
                            {{ getConnectionTypeText(item.contact_type) }}
                          </v-chip>
                        </template>

                        <!-- 验证状态列 -->
                        <template v-slot:item.verified="{ item }">
                          <v-icon
                            :color="item.verified ? 'success' : 'warning'"
                            :icon="
                              item.verified
                                ? 'mdi-check-circle'
                                : 'mdi-alert-circle'
                            "
                          ></v-icon>
                          {{ item.verified ? "已验证" : "未验证" }}
                        </template>

                        <!-- 随机值列 -->
                        <template v-slot:item.contact_info="{ item }">
                          <div v-if="item.contact_info">
                            <div v-if="item.contact_info.username">
                              用户名: {{ item.contact_info.username }}
                            </div>
                            <div
                              v-if="item.contact_info.email"
                              class="text-caption"
                            >
                              邮箱: {{ item.contact_info.email }}
                            </div>
                          </div>
                          <span v-else class="text-caption">无详细信息</span>
                        </template>

                        <!-- 操作列 -->
                        <template v-slot:item.actions="{ item }">
                          <v-btn
                            class="mr-2"
                            icon="mdi-pencil"
                            size="small"
                            @click="editConnection(item)"
                          ></v-btn>
                          <v-btn
                            color="error"
                            icon="mdi-delete"
                            size="small"
                            @click="confirmDeleteConnection(item)"
                          ></v-btn>
                        </template>
                      </v-data-table>
                    </v-col>
                  </v-row>
                </v-container>
              </v-window-item>

              <!-- 头像设置标签页 -->
              <v-window-item :value="3">
                <v-container>
                  <v-row align="center" justify="center">
                    <v-col class="text-center" cols="12">
                      <v-avatar class="mb-4" size="150">
                        <v-img
                          :src="s3BucketUrl + '/user/' + userData.avatar"
                        ></v-img>
                      </v-avatar>
                      <div>
                        <v-text-field
                          v-model="userData.avatar"
                          class="mt-4"
                          dense
                          label="头像图片哈希"
                          outlined
                        ></v-text-field>
                      </div>
                    </v-col>
                  </v-row>
                </v-container>
              </v-window-item>
              <v-window-item :value="4">
                <pre>{{ userData }}</pre>
              </v-window-item>

              <v-window-item v-if="isCurrentUserAdmin" :value="5">
                <v-container>
                  <v-alert
                    class="mb-4"
                    density="compact"
                    text="目标类型固定为 user，目标 ID 固定为当前用户 ID。可用于调试 ow_target_configs（project_config）。"
                    type="info"
                    variant="tonal"
                  ></v-alert>

                  <v-row class="mb-2" dense>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model="targetConfigQuery.key"
                        clearable
                        density="compact"
                        label="key 精确匹配"
                        variant="outlined"
                        @keyup.enter="applyTargetConfigFilters"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model="targetConfigQuery.keyLike"
                        clearable
                        density="compact"
                        label="key 模糊匹配"
                        variant="outlined"
                        @keyup.enter="applyTargetConfigFilters"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="2">
                      <v-select
                        v-model="targetConfigQuery.itemsPerPage"
                        :items="[10, 20, 50, 100, 200]"
                        density="compact"
                        label="每页"
                        variant="outlined"
                        @update:model-value="applyTargetConfigFilters"
                      ></v-select>
                    </v-col>
                    <v-col class="d-flex ga-2 flex-wrap" cols="12" md="4">
                      <v-btn color="primary" prepend-icon="mdi-magnify" @click="applyTargetConfigFilters">
                        查询
                      </v-btn>
                      <v-btn prepend-icon="mdi-refresh" variant="tonal" @click="resetTargetConfigFilters">
                        重置
                      </v-btn>
                      <v-btn color="success" prepend-icon="mdi-plus" variant="tonal" @click="openCreateTargetConfigDialog">
                        新增
                      </v-btn>
                    </v-col>
                  </v-row>

                  <v-alert
                    v-if="targetConfigError"
                    class="mb-3"
                    density="compact"
                    type="error"
                    variant="tonal"
                  >
                    {{ targetConfigError }}
                  </v-alert>

                  <v-data-table-server
                    v-model:items-per-page="targetConfigQuery.itemsPerPage"
                    v-model:page="targetConfigQuery.page"
                    :headers="targetConfigHeaders"
                    :items="targetConfigItems"
                    :items-length="targetConfigTotal"
                    :loading="targetConfigLoading"
                    item-value="id"
                    @update:options="loadTargetConfigs"
                  >
                    <template v-slot:item.value="{ item }">
                      <pre class="target-config-value">{{ formatTargetConfigValue(item.value) }}</pre>
                    </template>

                    <template v-slot:item.updated_at="{ item }">
                      {{ formatDateTime(item.updated_at) }}
                    </template>

                    <template v-slot:item.actions="{ item }">
                      <v-btn
                        color="primary"
                        prepend-icon="mdi-pencil"
                        size="small"
                        variant="text"
                        @click="openEditTargetConfigDialog(item)"
                      >
                        编辑
                      </v-btn>
                    </template>
                  </v-data-table-server>
                </v-container>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-form>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="close">取消</v-btn>
        <v-btn
          :disabled="!formValid || saving"
          :loading="saving"
          color="primary"
          @click="save"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 地区选择器对话框 -->
    <region-selector
      v-model="showRegionSelector"
      :selected-region="selectedRegion"
      @clear="onRegionClear"
      @select="onRegionSelect"
    />

    <!-- 添加/编辑连接对话框 -->
    <v-dialog v-model="connectionDialog.show" max-width="800px">
      <v-card>
        <v-card-title>
          {{ connectionDialog.isEdit ? "编辑连接 #" + connectionDialog.data.contact_id : "添加新连接" }}
        </v-card-title>
        <v-card-text>
          <v-form ref="connectionForm" v-model="connectionDialog.valid">
            <v-select
              v-if="!connectionDialog.isEdit"
              v-model="connectionDialog.data.contact_type"
              :items="oauthTypes"
              :rules="[(v) => !!v || '请选择连接类型']"
              label="连接类型"
              required
            ></v-select>

            <v-text-field
              v-if="!connectionDialog.isEdit"
              v-model="connectionDialog.data.contact_value"
              :rules="[(v) => !!v || '请输入提供商用户ID']"
              label="提供商用户ID"
              required
            ></v-text-field>

            <v-card class="mt-4 pa-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <div class="text-subtitle-1">连接信息</div>
                <v-spacer></v-spacer>
              </div>
              <v-text-field
                v-model="connectionDialog.data.contact_value"
                dense
                label="连接值"
                outlined
              ></v-text-field>
              <v-text-field
                v-model="connectionDialog.data.contact_info"
                dense
                label="随机值"
                outlined
              ></v-text-field>
              <v-select
                v-model="connectionDialog.data.contact_type"
                :items="oauthTypes"
                dense
                label="连接类型"
                outlined
              ></v-select>
            </v-card>

            <v-card class="mt-4 pa-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <div class="text-subtitle-1">元数据</div>
                <v-spacer></v-spacer>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  size="small"
                  @click="addMetadataField"
                >
                  添加字段
                </v-btn>
              </div>

              <div
                v-for="(value, key, index) in connectionDialog.data.metadata"
                :key="index"
                class="d-flex align-center mb-2 gap-2"
              >
                <v-text-field
                  v-model="connectionDialog.metadataKeys[index]"
                  class="flex-grow-0"
                  density="compact"
                  hide-details
                  label="字段名"
                  style="width: 200px"
                  @update:model-value="updateMetadataKey(index, key, $event)"
                ></v-text-field>
                <v-text-field
                  v-model="connectionDialog.data.metadata[key]"
                  :label="'值'"
                  class="flex-grow-1"
                  density="compact"
                  hide-details
                ></v-text-field>
                <v-btn
                  color="error"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  @click="removeMetadataField(key)"
                ></v-btn>
              </div>
            </v-card>

            <v-switch
              v-model="connectionDialog.data.verified"
              class="mt-4"
              color="success"
              hide-details
              label="已验证"
            ></v-switch>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="connectionDialog.show = false"> 取消</v-btn>
          <v-btn
            :disabled="!connectionDialog.valid || connectionDialog.saving"
            :loading="connectionDialog.saving"
            color="primary"
            @click="saveConnection"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除连接确认对话框 -->
    <v-dialog v-model="deleteConnectionDialog.show" max-width="400px">
      <v-card>
        <v-card-title class="text-h5 text-error"> 确认删除连接</v-card-title>
        <v-card-text>
          确定要删除这个
          {{
          getConnectionTypeText(
          deleteConnectionDialog.connection?.contact_type
          )
          }}
          连接吗？此操作不可撤销。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="deleteConnectionDialog.show = false">
            取消
          </v-btn>
          <v-btn
            :loading="deleteConnectionDialog.deleting"
            color="error"
            @click="deleteConnection"
          >
            确认删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="targetConfigDialog.show" max-width="800px">
      <v-card>
        <v-card-title>
          {{ targetConfigDialog.isEdit ? "编辑配置" : "新增配置" }}
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="targetConfigDialog.error"
            class="mb-3"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ targetConfigDialog.error }}
          </v-alert>

          <v-text-field
            v-model="targetConfigDialog.key"
            :disabled="targetConfigDialog.isEdit"
            density="compact"
            label="配置键（key）"
            variant="outlined"
          ></v-text-field>

          <v-switch
            v-model="targetConfigDialog.parseAsJson"
            class="mb-2"
            color="primary"
            density="compact"
            hide-details
            label="按 JSON 提交（会先做 JSON.parse 校验）"
          ></v-switch>

          <v-textarea
            v-model="targetConfigDialog.valueText"
            auto-grow
            density="compact"
            label="配置值（value）"
            min-rows="6"
            variant="outlined"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="targetConfigDialog.show = false">取消</v-btn>
          <v-btn
            :loading="targetConfigDialog.saving"
            color="primary"
            @click="saveTargetConfig"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script>
import RegionSelector from "@/components/account/RegionSelector.vue";
import axios from "@/axios/axios";
import {get} from "@/services/serverConfig";
import ProjectSelector from "../shared/ProjectSelector.vue";
import {localuser} from "@/services/localAccount";

export default {
  name: "UserEditor",

  components: {
    RegionSelector,
    ProjectSelector
  },

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    user: {
      type: Object,
      required: true,
      default: () => ({}), // 提供默认空对象
    },
  },

  emits: ["update:modelValue", "save"],

  data() {
    return {
      // 表单控制
      tabIndex: 1,
      formValid: true,
      saving: false,
      showRegionSelector: false,
      selectedRegion: null,
      regionOptions: [], // 添加regionOptions到data中
      localuser,

      // 选项配置
      statusOptions: [
        {text: "活跃", value: "active"},
        {text: "已暂停", value: "suspended"},
        {text: "已封禁", value: "banned"},
        {text: "待验证", value: "pending"},
      ],
      typeOptions: [
        {text: "访客", value: "guest"},
        {text: "普通用户", value: "user"},
        {text: "管理员", value: "admin"},
      ],
      sexOptions: [
        {text: "男", value: "male"},
        {text: "女", value: "female"},
        {text: "其他", value: "other"},
      ],
      contactTypes: [
        {text: "邮箱", value: "email"},
        {text: "电话", value: "phone"},
        {text: "QQ", value: "qq"},
        {text: "Google", value: "oauth_google"},
        {text: "GitHub", value: "oauth_github"},
        {text: "Microsoft", value: "oauth_microsoft"},
        {text: "40code", value: "oauth_40code"},
        {text: "LinuxDo", value: "oauth_linuxdo"},
        {text: "其他", value: "other"},
      ],

      // 用户数据
      userData: this.initUserData(),

      // 连接管理相关
      connections: [],
      loadingConnections: false,
      connectionHeaders: [
        {title: "类型", key: "contact_type", width: "150px"},
        {title: "验证状态", key: "verified", width: "100px"},
        {title: "创建时间", key: "created_at", width: "180px"},
        {title: "操作", key: "actions", width: "100px", sortable: false},
      ],
      oauthTypes: [
        {title: "Google", value: "oauth_google"},
        {title: "GitHub", value: "oauth_github"},
        {title: "Microsoft", value: "oauth_microsoft"},
        {title: "40code", value: "oauth_40code"},
        {title: "LinuxDo", value: "oauth_linuxdo"},
        {title: "email", value: "email"},
        {title: "phone", value: "phone"},
        {title: "qq", value: "qq"},
        {title: "other", value: "other"},
      ],
      connectionDialog: {
        show: false,
        isEdit: false,
        valid: true,
        saving: false,
        data: this.initConnectionData(),
        infoKeys: [], // 用于跟踪 contact_info 的键
        metadataKeys: [], // 用于跟踪 metadata 的键
      },
      deleteConnectionDialog: {
        show: false,
        deleting: false,
        connection: null,
      },
      targetConfigHeaders: [
        {title: "Key", key: "key", width: "240px"},
        {title: "Value", key: "value", sortable: false},
        {title: "更新时间", key: "updated_at", width: "180px"},
        {title: "操作", key: "actions", sortable: false, width: "100px"},
      ],
      targetConfigItems: [],
      targetConfigTotal: 0,
      targetConfigLoading: false,
      targetConfigError: "",
      targetConfigQuery: {
        page: 1,
        itemsPerPage: 20,
        key: "",
        keyLike: "",
      },
      targetConfigDialog: {
        show: false,
        isEdit: false,
        saving: false,
        key: "",
        originalKey: "",
        valueText: "",
        parseAsJson: false,
        error: "",
      },
      s3BucketUrl: "",
    };
  },

  computed: {
    isCurrentUserAdmin() {
      const currentUser = this.localuser.user?.value || {};
      return (
        currentUser.type === "administrator" || currentUser.role === "admin"
      );
    },
  },

  async created() {
    // 加载地区选项
    try {
      const region_zh_CN = await import("@/constants/region_zh-CN.json");
      this.regionOptions = Object.entries(region_zh_CN.default).map(
        ([value, text]) => ({
          value,
          text,
        })
      );
    } catch (error) {
      console.error("Error loading region options:", error);
      this.regionOptions = [];
    }
    this.s3BucketUrl = get("s3.staticurl");
  },

  watch: {
    user: {
      handler(newUser) {
        if (!newUser) {
          this.userData = this.initUserData();
          this.selectedRegion = null;
          return;
        }

        this.userData = this.initUserData(newUser);

        // 设置地区
        if (newUser?.region) {
          const regionText = this.getRegionText(newUser.region);
          if (regionText) {
            this.selectedRegion = {
              value: newUser.region,
              text: regionText,
            };
          } else {
            this.selectedRegion = null;
          }
        } else {
          this.selectedRegion = null;
        }

        if (newUser?.id) {
          this.loadConnections();
          if (this.isCurrentUserAdmin) {
            this.loadTargetConfigs();
          }
        }
      },
      immediate: true,
    },
  },

  methods: {
    initUserData(user = {}) {
      // 确保user参数有默认值
      return {
        // 基本信息
        id: user?.id ?? null,
        username: user?.username ?? "",
        display_name: user?.display_name ?? "",
        status: user?.status ?? "active",
        type: user?.type ?? "user",
        email: user?.email ?? "",
        featured_projects: user?.featured_projects ?? "",
        // 个人资料
        bio: user?.bio ?? "",
        location: user?.location ?? "",
        region: user?.region ?? "",
        birthday: user?.birthday ?? "",
        sex: user?.sex ?? "",
        url: user?.url ?? "",
        // 自定义状态
        custom_status: user?.custom_status ?? {
          emoji: "",
          text: "",
        },

        // 头像
        avatar: user?.avatar ?? "",

        // 特色项目
        featured_projects: user?.featured_projects ?? [],

        // 联系方式
        contacts: (user?.contacts ?? []).map((contact) => ({
          contact_type: contact?.contact_type ?? "",
          contact_value: contact?.contact_value ?? "",
          is_primary: contact?.is_primary ?? false,
          verified: contact?.verified ?? false,
          contact_info: contact?.contact_info ?? "",
          metadata: contact?.metadata ?? {},
        })),
      };
    },

    getRegionText(regionValue) {
      if (!regionValue) return "";
      const region = this.regionOptions.find((r) => r.value === regionValue);
      return region ? region.text : regionValue;
    },

    addContact() {
      this.userData.contacts.push({
        contact_type: "",
        contact_value: "",
        is_primary: false,
        verified: false,
        contact_info: "",
        metadata: {},
      });
    },

    removeContact(index) {
      this.userData.contacts.splice(index, 1);
    },

    onRegionSelect(region) {
      this.selectedRegion = region;
      this.userData.region = region.value;
      this.showRegionSelector = false;
    },

    onRegionClear() {
      this.selectedRegion = null;
      this.userData.region = null;
      this.showRegionSelector = false;
    },

    onTabChange(tabValue) {
      this.tabIndex = tabValue;
      if (
        tabValue === 5 &&
        this.isCurrentUserAdmin &&
        this.userData.id &&
        !this.targetConfigItems.length
      ) {
        this.loadTargetConfigs();
      }
    },

    close() {
      this.$emit("update:modelValue", false);
    },

    formatDateTime(dateValue) {
      if (!dateValue) return "-";
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleString("zh-CN", {hour12: false});
    },

    formatTargetConfigValue(value) {
      if (value === null || value === undefined) return "";
      if (typeof value !== "string") {
        return JSON.stringify(value, null, 2);
      }
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    },

    buildTargetConfigParams() {
      const params = {
        page: this.targetConfigQuery.page,
        itemsPerPage: this.targetConfigQuery.itemsPerPage,
      };
      const key = (this.targetConfigQuery.key || "").trim();
      const keyLike = (this.targetConfigQuery.keyLike || "").trim();
      if (key) {
        params.key = key;
      } else if (keyLike) {
        params.keyLike = keyLike;
      }
      return params;
    },

    async loadTargetConfigs() {
      if (!this.isCurrentUserAdmin || !this.userData.id) return;

      this.targetConfigLoading = true;
      this.targetConfigError = "";
      try {
        const {data} = await axios.get(
          `/admin/users/${this.userData.id}/target-configs`,
          {
            params: this.buildTargetConfigParams(),
          }
        );

        const payload = data?.data || data || {};
        this.targetConfigItems = Array.isArray(payload.items) ? payload.items : [];
        this.targetConfigTotal = Number(payload.total || 0);
        this.targetConfigQuery.page = Number(payload.page || this.targetConfigQuery.page || 1);
        this.targetConfigQuery.itemsPerPage = Number(
          payload.itemsPerPage || this.targetConfigQuery.itemsPerPage || 20
        );
      } catch (error) {
        this.targetConfigError =
          error?.response?.data?.message || "加载用户 ow_target_config 失败";
        console.error("Error loading user target configs:", error);
      } finally {
        this.targetConfigLoading = false;
      }
    },

    async applyTargetConfigFilters() {
      this.targetConfigQuery.page = 1;
      await this.loadTargetConfigs();
    },

    async resetTargetConfigFilters() {
      this.targetConfigQuery.key = "";
      this.targetConfigQuery.keyLike = "";
      this.targetConfigQuery.page = 1;
      await this.loadTargetConfigs();
    },

    openCreateTargetConfigDialog() {
      this.targetConfigDialog = {
        show: true,
        isEdit: false,
        saving: false,
        key: "",
        originalKey: "",
        valueText: "",
        parseAsJson: false,
        error: "",
      };
    },

    openEditTargetConfigDialog(item) {
      const rawValue = item?.value ?? "";
      let parseAsJson = false;
      let valueText = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);

      if (typeof rawValue === "string") {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed !== null && typeof parsed !== "string") {
            parseAsJson = true;
            valueText = JSON.stringify(parsed, null, 2);
          }
        } catch {
          parseAsJson = false;
        }
      }

      this.targetConfigDialog = {
        show: true,
        isEdit: true,
        saving: false,
        key: item?.key || "",
        originalKey: item?.key || "",
        valueText,
        parseAsJson,
        error: "",
      };
    },

    async saveTargetConfig() {
      if (!this.userData.id || !this.isCurrentUserAdmin) return;

      const key = (this.targetConfigDialog.key || "").trim();
      if (!key) {
        this.targetConfigDialog.error = "配置键不能为空";
        return;
      }

      let requestValue = this.targetConfigDialog.valueText;
      if (this.targetConfigDialog.parseAsJson) {
        try {
          requestValue = JSON.parse(this.targetConfigDialog.valueText || "null");
        } catch {
          this.targetConfigDialog.error = "JSON 格式无效，请检查后再提交";
          return;
        }
      }

      this.targetConfigDialog.saving = true;
      this.targetConfigDialog.error = "";
      try {
        await axios.put(
          `/admin/users/${this.userData.id}/target-configs/${encodeURIComponent(key)}`,
          {
            value: requestValue,
          }
        );
        this.targetConfigDialog.show = false;
        await this.loadTargetConfigs();
      } catch (error) {
        this.targetConfigDialog.error =
          error?.response?.data?.message || "保存 ow_target_config 失败";
        console.error("Error saving user target config:", error);
      } finally {
        this.targetConfigDialog.saving = false;
      }
    },

    async save() {
      if (!this.$refs.editForm.validate()) return;

      this.saving = true;
      try {
        await this.$emit("save", this.userData);
        this.close();
      } finally {
        this.saving = false;
      }
    },

    // 初始化连接数据
    initConnectionData() {
      return {
        contact_type: "",
        contact_value: "",
        contact_info: "",
        metadata: {},
        verified: false,
      };
    },

    // 加载用户连接
    async loadConnections() {
      if (!this.userData.id) return;

      this.loadingConnections = true;
      try {
        const {data} = await axios.get(
          `/admin/users/${this.userData.id}/connections`
        );
        this.connections = data;
      } catch (error) {
        console.error("Error loading connections:", error);
        // 显示错误提示
      } finally {
        this.loadingConnections = false;
      }
    },

    // 显示添加连接对话框
    showAddConnectionDialog() {
      this.connectionDialog.isEdit = false;
      this.connectionDialog.data = this.initConnectionData();
      this.connectionDialog.infoKeys = [];
      this.connectionDialog.metadataKeys = [];
      this.connectionDialog.show = true;
    },

    // 显示编辑连接对话框
    editConnection(connection) {
      this.connectionDialog.isEdit = true;
      this.connectionDialog.data = {
        ...connection,
        metadata: {...connection.metadata},
      };
      // 初始化键数组
      this.connectionDialog.metadataKeys = Object.keys(
        connection.metadata || {}
      );
      this.connectionDialog.show = true;
    },

    // 添加元数据字段
    addMetadataField() {
      const newKey = `field_${this.connectionDialog.metadataKeys.length + 1}`;
      this.$set(this.connectionDialog.data.metadata, newKey, "");
      this.connectionDialog.metadataKeys.push(newKey);
    },

    // 更新元数据字段的键
    updateMetadataKey(index, oldKey, newKey) {
      if (newKey && newKey !== oldKey) {
        const value = this.connectionDialog.data.metadata[oldKey];
        this.$delete(this.connectionDialog.data.metadata, oldKey);
        this.$set(this.connectionDialog.data.metadata, newKey, value);
        this.connectionDialog.metadataKeys[index] = newKey;
      }
    },

    // 删除元数据字段
    removeMetadataField(key) {
      this.$delete(this.connectionDialog.data.metadata, key);
      const index = this.connectionDialog.metadataKeys.indexOf(key);
      if (index > -1) {
        this.connectionDialog.metadataKeys.splice(index, 1);
      }
    },

    // 保存连接
    async saveConnection() {
      if (!this.$refs.connectionForm?.validate()) return;

      this.connectionDialog.saving = true;
      try {
        if (this.connectionDialog.isEdit) {
          await axios.put(
            `/admin/users/${this.userData.id}/connections/${this.connectionDialog.data.contact_id}`,
            {
              contact_info: this.connectionDialog.data.contact_info,
              contact_value: this.connectionDialog.data.contact_value,
              metadata: this.connectionDialog.data.metadata,
              contact_type: this.connectionDialog.data.contact_type,
              verified: this.connectionDialog.data.verified,
            }
          );
        } else {
          await axios.post(`/admin/users/${this.userData.id}/connections`, {
            contact_info: this.connectionDialog.data.contact_info,
            contact_value: this.connectionDialog.data.contact_value,
            metadata: this.connectionDialog.data.metadata,
            contact_type: this.connectionDialog.data.contact_type,
            verified: this.connectionDialog.data.verified,
          });
        }

        await this.loadConnections();
        this.connectionDialog.show = false;
      } catch (error) {
        console.error("Error saving connection:", error);
        // 显示错误提示
      } finally {
        this.connectionDialog.saving = false;
      }
    },

    // 确认删除连接
    confirmDeleteConnection(connection) {
      this.deleteConnectionDialog.connection = connection;
      this.deleteConnectionDialog.show = true;
    },

    // 删除连接
    async deleteConnection() {
      if (!this.deleteConnectionDialog.connection) return;

      this.deleteConnectionDialog.deleting = true;
      try {
        await axios.delete(
          `/admin/users/${this.userData.id}/connections/${this.deleteConnectionDialog.connection.contact_id}`
        );

        await this.loadConnections();
        this.deleteConnectionDialog.show = false;
      } catch (error) {
        console.error("Error deleting connection:", error);
        // 显示错误提示
      } finally {
        this.deleteConnectionDialog.deleting = false;
      }
    },

    // 获取连接类型显示文本
    getConnectionTypeText(type) {
      const found = this.oauthTypes.find((t) => t.value === type);
      return found ? found.title : type;
    },

    // 获取连接类型颜色
    getConnectionTypeColor(type) {
      const colors = {
        oauth_google: "red",
        oauth_github: "grey-darken-3",
        oauth_microsoft: "blue",
        oauth_40code: "purple",
        oauth_linuxdo: "green",
      };
      return colors[type] || "grey";
    },
  },
};
</script>

<style lang="scss" scoped>
.contact-list {
  max-height: 300px;
  overflow-y: auto;
}

.custom-status {
  display: flex;
  align-items: center;
  gap: 8px;

  .emoji-picker {
    width: 80px;
  }

  .status-text {
    flex: 1;
  }
}

.gap-2 {
  gap: 8px;
}

.target-config-value {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  max-height: 180px;
  overflow: auto;
}
</style>
