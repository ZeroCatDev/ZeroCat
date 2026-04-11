<template>
  <v-form v-model="valid" @submit.prevent="updateProfile">
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="profileData.display_name"
          :counter="20"
          :rules="nameRules"
          density="comfortable"
          label="显示名称"
          required
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="selectedGender"
          :items="genderOptions"
          density="comfortable"
          item-title="state"
          item-value="abbr"
          label="性别"
          persistent-hint
          return-object
          variant="outlined"
        ></v-select>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="profileData.location"
          :counter="100"
          :rules="locationRules"
          density="comfortable"
          label="地点"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          :model-value="profileData.region?.text || ''"
          :rules="regionRules"
          density="comfortable"
          hint="点击选择您所在的区域"
          label="区域"
          persistent-hint
          readonly
          variant="outlined"
          @click="showRegionDialog = true"
        >
          <template v-slot:append>
            <v-btn
              icon="mdi-map-marker"
              variant="text"
              @click="showRegionDialog = true"
            ></v-btn>
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="profileData.url"
          :counter="255"
          :rules="urlRules"
          density="comfortable"
          label="个人网站"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="profileData.birthday"
          :rules="birthdayRules"
          density="comfortable"
          label="生日"
          type="date"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-text-field
          v-model="profileData.bio"
          :counter="500"
          density="comfortable"
          label="个人简介"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-card variant="tonal" rounded="lg" class="pa-4">
          <div class="d-flex flex-wrap align-center ga-3">
            <div class="flex-grow-1">
              <div class="text-subtitle-1 font-weight-medium">详细介绍（README 项目）</div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                使用与 GitHub 类似的方式：通过 <strong>{{ readmePath }}</strong> 项目维护个人详细介绍。
              </div>
            </div>
            <v-chip size="small" variant="outlined" prepend-icon="mdi-file-document-outline">
              {{ readmeChecking ? '检测中' : (readmeExists ? '已存在' : '未创建') }}
            </v-chip>
          </div>

          <v-progress-linear
            v-if="readmeChecking"
            indeterminate
            color="primary"
            class="mt-3"
            rounded
          />

          <div class="d-flex flex-wrap ga-2 mt-4">
            <v-btn
              color="primary"
              variant="elevated"
              prepend-icon="mdi-book-open-page-variant-outline"
              :loading="readmeLoading"
              :disabled="readmeChecking"
              @click="openOrCreateReadmeProject"
            >{{ readmeChecking ? '检测 README 项目中...' : (readmeExists ? '打开 README 项目' : '创建并编辑 README 项目') }}</v-btn>

            <v-btn
              v-if="!readmeChecking && readmeExists"
              variant="tonal"
              prepend-icon="mdi-open-in-new"
              :to="readmeArticleViewPath"
            >查看 README 页面</v-btn>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <ProjectSelector
          v-model="profileData.featured_projects"
          :multiple="false"
          :author="'me'"
        />
        <v-text-field
        disabled
          v-model="profileData.featured_projects"
          :rules="projectIdRules"
          density="comfortable"
          hint="输入您的项目ID"
          label="精选项目ID"
          persistent-hint
          type="number"
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-btn
          :disabled="!valid"
          :loading="loading"
          class="px-6"
          color="primary"
          prepend-icon="mdi-content-save"
          size="large"
          @click="updateProfile"
        >
          保存资料
        </v-btn>
      </v-col>
    </v-row>

    <RegionSelector
      v-model="showRegionDialog"
      :selected-region="profileData.region"
      @clear="clearRegion"
      @select="selectRegion"
    />
  </v-form>
</template>

<script>
import {updateUserInfo} from "@/services/accountService";
import { getProjectInfoByNamespace, initProject } from "@/services/projectService";
import request from "@/axios/axios";
import region_zh_CN from "@/constants/region_zh-CN.json";
import RegionSelector from "./RegionSelector.vue";
import ProjectSelector from "../shared/ProjectSelector.vue";

export default {
  name: "ProfileEditor",
  components: {
    RegionSelector,
    ProjectSelector
  },
  props: {
    userData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      valid: false,
      showRegionDialog: false,
      readmeLoading: false,
      readmeChecking: true,
      readmeExists: false,
      profileData: {
        display_name: this.userData.display_name || '',
        bio: this.userData.bio || '',
        location: this.userData.location || '',
        region: this.userData.region ? {
          value: this.userData.region,
          text: region_zh_CN[this.userData.region] || ''
        } : null,
        url: this.userData.url || '',
        birthday: this.userData.birthday || '',
        featured_projects: this.userData.featured_projects || ''
      },
      selectedGender: {state: "未知", abbr: "3"},
      genderOptions: [
        {state: "男", abbr: "0"},
        {state: "女", abbr: "1"},
        {state: "猫娘", abbr: "2"},
        {state: "未知", abbr: "3"},
      ],
      nameRules: [
        v => !!v || "名称是必填项",
        v => (v && v.length <= 20) || "名称不能超过20个字符"
      ],
      locationRules: [
        v => !v || v.length <= 100 || "地址不能超过100个字符"
      ],
      regionRules: [
        v => !v || v.length <= 100 || "区域不能超过100个字符"
      ],
      urlRules: [
        v => !v || v.length <= 255 || "URL不能超过255个字符",
        v => !v || /^https?:\/\/.*/.test(v) || "URL必须以http://或https://开头"
      ],
      birthdayRules: [
        v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || "生日格式必须为YYYY-MM-DD"
      ],
      projectIdRules: [
        v => !v || /^\d+$/.test(v) || "项目ID必须是数字"
      ]
    };
  },
  computed: {
    readmePath() {
      const username = this.userData?.username || 'username';
      return `/${username}/${username}`;
    },
    readmeArticleViewPath() {
      const username = this.userData?.username || 'username';
      return `/${username}/articles/${username}`;
    }
  },
  watch: {
    userData: {
      handler(newVal) {
        this.profileData = {
          display_name: newVal.display_name || '',
          bio: newVal.bio || '',
          location: newVal.location || '',
          region: newVal.region ? {
            value: newVal.region,
            text: region_zh_CN[newVal.region] || ''
          } : null,
          url: newVal.url || '',
          birthday: newVal.birthday ? this.formatDateForInput(newVal.birthday) : '',
          featured_projects: newVal.featured_projects || ''
        };
        this.selectedGender = this.genderOptions.find(item => item.abbr == newVal.sex) || this.genderOptions[3];
      },
      immediate: true,
      deep: true
    },
    'userData.username': {
      handler() {
        this.checkReadmeProjectExists();
      },
      immediate: true
    }
  },
  methods: {
    getUsername() {
      return this.userData?.username || '';
    },
    getReadmeProjectName() {
      const username = this.getUsername();
      return username;
    },
    async checkReadmeProjectExists() {
      const username = this.getUsername();
      const projectName = this.getReadmeProjectName();
      if (!username || !projectName) {
        this.readmeChecking = false;
        this.readmeExists = false;
        return;
      }

      this.readmeChecking = true;
      try {
        const project = await getProjectInfoByNamespace(username, projectName);
        this.readmeExists = Boolean(project?.id && project.id !== 0 && project?.type === 'article');
      } catch {
        this.readmeExists = false;
      } finally {
        this.readmeChecking = false;
      }
    },
    async openOrCreateReadmeProject() {
      const username = this.getUsername();
      const projectName = this.getReadmeProjectName();
      if (!username || !projectName) {
        this.$emit('error', new Error('无法获取当前用户名'));
        return;
      }

      this.readmeLoading = true;
      try {
        const existing = await getProjectInfoByNamespace(username, projectName);
        if (existing?.id && existing.id !== 0 && existing?.type === 'article') {
          this.readmeExists = true;
          this.$router.push(`/${username}/articles/${projectName}/edit`);
          return;
        }

        const createRes = await request.post('/project/', {
          name: projectName,
          title: 'README.md',
          description: '',
          state: 'public',
          type: 'article',
          license: 'None'
        });

        if (createRes?.data?.status === 'error') {
          throw new Error(createRes?.data?.message || '创建 README 项目失败');
        }

        const projectId = createRes?.data?.data?.id ?? createRes?.data?.id;
        if (projectId) {
          await initProject(projectId, 'text');
        }

        this.readmeExists = true;
        this.$router.push(`/${username}/articles/${projectName}/edit`);
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.readmeLoading = false;
      }
    },
    formatDateForInput(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    },
    selectRegion(region) {
      this.profileData.region = region;
      this.showRegionDialog = false;
    },
    clearRegion() {
      this.profileData.region = null;
      this.showRegionDialog = false;
    },
    async updateProfile() {
      if (!this.valid) return;

      this.loading = true;
      try {
        const response = await updateUserInfo({
          display_name: this.profileData.display_name,
          bio: this.profileData.bio || undefined,
          location: this.profileData.location,
          region: this.profileData.region?.value || '',
          sex: this.selectedGender.abbr,
          url: this.profileData.url,
          birthday: this.profileData.birthday,
          featured_projects: this.profileData.featured_projects || undefined
        });

        this.$emit('profile-updated', response);
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.region-list {
  max-height: 400px;
  overflow-y: auto;
}
</style>
