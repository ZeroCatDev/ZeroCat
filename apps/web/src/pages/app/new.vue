<template>
  <v-container class="new-project-page" max-width="880">
    <div class="mb-6">
      <h1 class="text-h4 font-weight-medium mb-1">创建一个新的作品</h1>
      <p class="text-body-2 text-medium-emphasis mb-0">
        作品包含你的代码文件和完整的修订历史。你可以随时在作品设置中修改下述信息。
      </p>
    </div>

    <v-card border flat class="pa-6">
      <div class="d-flex align-center ga-3 mb-4">
        <v-chip size="small" variant="tonal" color="primary">{{ localuser.user.value?.username || 'me' }}</v-chip>
        <v-icon size="small">mdi-slash-forward</v-icon>
        <v-text-field
          v-model="projectinfo.name"
          placeholder="project-name"
          variant="outlined"
          density="comfortable"
          hide-details="auto"
          :error-messages="nameError ? [nameError] : []"
          class="flex-grow-1"
          @blur="onNameBlur"
        />
      </div>
      <div class="text-caption text-medium-emphasis mb-6">
        需要灵感？
        <a href="javascript:void(0)" class="text-primary" @click="projectinfo.name = examplename">{{ examplename }}</a>
      </div>

      <v-textarea
        v-model="projectinfo.description"
        label="描述（可选）"
        variant="outlined"
        density="comfortable"
        rows="2"
        auto-grow
        counter="1000"
        maxlength="1000"
        class="mb-4"
      />

      <v-row dense class="mb-2">
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 mb-2">作品类型</div>
          <LanguageSelector v-model="projectinfo.type" label="选择作品类型" required />
        </v-col>
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 mb-2">许可证</div>
          <LicenseSelector v-model="projectinfo.license" />
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <div class="text-subtitle-2 mb-2">可见性</div>
      <v-radio-group v-model="projectinfo.state" density="comfortable" hide-details class="mb-2">
        <v-radio value="public">
          <template #label>
            <div>
              <v-icon size="16" class="me-1">mdi-earth</v-icon>
              <strong>公开</strong>
              <div class="text-caption text-medium-emphasis">任何人都可查看此作品。</div>
            </div>
          </template>
        </v-radio>
        <v-radio value="private">
          <template #label>
            <div>
              <v-icon size="16" class="me-1">mdi-lock</v-icon>
              <strong>私密</strong>
              <div class="text-caption text-medium-emphasis">只有你可见。</div>
            </div>
          </template>
        </v-radio>
      </v-radio-group>
    </v-card>

    <v-card border flat class="pa-5 mt-4">
      <div class="d-flex align-center ga-3 mb-3">
        <v-icon>mdi-github</v-icon>
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-medium">GitHub 同步</div>
          <div class="text-caption text-medium-emphasis">
            创建后将项目绑定到 GitHub 仓库，每次提交自动推送。
            <template v-if="isArticle">
              文章项目的聚合同步（博客）请到
              <router-link to="/app/account/blog-sync" class="text-primary">博客同步</router-link>
              配置，两者互不影响。
            </template>
          </div>
        </div>
        <v-switch
          v-model="syncEnabled"
          color="primary"
          density="comfortable"
          hide-details
          inset
        />
      </div>

      <template v-if="syncEnabled">
        <GitAccountPicker
          v-model="selectedLinkId"
          label="选择 GitHub 账号"
          class="mb-3"
          @links="onLinksLoaded"
        />

        <div v-if="selectedLink" class="mb-2">
          <GitRepoPicker
            v-model="selectedRepo"
            :link-id="selectedLinkId"
            :owner-login="selectedLink.account?.login || ''"
            :default-repo-name="projectinfo.name"
            :default-description="projectinfo.description"
            :default-private="projectinfo.state === 'private'"
          />
        </div>

        <v-expansion-panels variant="accordion" class="mt-2">
          <v-expansion-panel title="高级选项">
            <template #text>
              <v-text-field
                v-model="advanced.fileName"
                label="同步文件名"
                placeholder="project.json"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-2"
              />
              <v-text-field
                v-model="advanced.branch"
                label="默认分支"
                placeholder="main"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-2"
              />
            </template>
          </v-expansion-panel>
        </v-expansion-panels>
      </template>
    </v-card>

    <div class="d-flex justify-end mt-6 ga-2">
      <v-btn variant="text" :disabled="submitting" @click="$router.back()">取消</v-btn>
      <v-btn
        color="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ syncEnabled ? '创建并同步到 GitHub' : '创建作品' }}
      </v-btn>
    </div>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import { generate } from 'random-words';
import request from '@/axios/axios';
import { localuser } from '@/services/localAccount';
import LicenseSelector from '@/components/LicenseSelector.vue';
import LanguageSelector from '@/components/LanguageSelector.vue';
import GitAccountPicker from '@/components/GitAccountPicker.vue';
import GitRepoPicker from '@/components/GitRepoPicker.vue';
import GitSyncService from '@/services/gitSyncService';
import { useToast } from 'primevue/usetoast';

useHead({ title: '新建作品' });

const router = useRouter();
const toast = useToast();

const notify = (severity, summary, detail) => {
  toast.add({ severity, summary, detail, life: 3000 });
};

const projectinfo = reactive({
  title: '新建作品',
  type: 'scratch',
  name: '',
  state: 'public',
  description: '',
  license: 'None',
});

const examplename = generate(Math.floor(Math.random() * 2) + 2).join('-');

const submitting = ref(false);
const nameError = ref('');

const syncEnabled = ref(false);
const links = ref([]);
const selectedLinkId = ref(null);
const selectedRepo = ref(null);
const advanced = reactive({ fileName: '', branch: 'main' });

const isArticle = computed(() => String(projectinfo.type || '').toLowerCase() === 'article');
const selectedLink = computed(() => links.value.find((l) => l.id === selectedLinkId.value));

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (!projectinfo.name || nameError.value) return false;
  if (syncEnabled.value) {
    if (!selectedLinkId.value) return false;
    if (!selectedRepo.value) return false;
  }
  return true;
});

function onLinksLoaded(list) {
  links.value = list || [];
}

watch(() => selectedLinkId.value, () => { selectedRepo.value = null; });

function onNameBlur() {
  const name = (projectinfo.name || '').trim();
  if (!name) { nameError.value = '项目名称不能为空'; return; }
  if (!/^[0-9A-Za-z._-]+$/.test(name) || name.length > 100) {
    nameError.value = '只允许字母、数字、._- 且不超过 100 字符';
    return;
  }
  nameError.value = '';
}

async function submit() {
  onNameBlur();
  if (nameError.value) return;
  submitting.value = true;
  try {
    projectinfo.title = projectinfo.name;
    const createRes = await request.post('/project/', projectinfo);
    if (createRes.data?.status !== 'success') {
      notify("error", "错误", createRes.data?.message || '创建失败');
      submitting.value = false;
      return;
    }
    const projectId = createRes.data.id;
    const targetUrl = `/${localuser.user.value.username}/${projectinfo.name}`;

    if (syncEnabled.value && selectedLinkId.value && selectedRepo.value) {
      try {
        const bindRes = await GitSyncService.bindProject(projectId, {
          linkId: selectedLinkId.value,
          repoOwner: selectedRepo.value.owner,
          repoName: selectedRepo.value.name,
          branch: advanced.branch || selectedRepo.value.default_branch || 'main',
          fileName: advanced.fileName || undefined,
          enabled: true,
        });
        if (bindRes.status === 'success') {
          notify('success', '成功', `项目已绑定到 ${selectedRepo.value.full_name}`);
        } else {
          notify('warn', '提示', bindRes.message || '绑定失败，可在项目设置中重试');
        }
      } catch (e) {
        notify('warn', '提示', e?.response?.data?.message || '绑定失败，可在项目设置中重试');
      }
    } else {
      notify('success', '成功', '作品已创建');
    }

    router.push(targetUrl);
  } catch (e) {
    notify("error", "错误", '创建时发生错误');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.new-project-page {
  padding-top: 32px;
  padding-bottom: 48px;
}
</style>
