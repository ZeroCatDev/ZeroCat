<template>
  <v-container>
    <v-row>
      <v-col cols="12"><h1>常规</h1></v-col>
      <v-col cols="7">
        <v-text-field
          v-model="newProjectName"
          hint="修改项目名称"
          label="项目名称"
          required
          variant="outlined"
        >
          <template v-slot:append>
            <v-btn
              color="primary"
              text="修改名称"
              variant="tonal"
              @click="renameProject"
            ></v-btn>
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12">
        <v-divider></v-divider>
      </v-col>
      <v-col cols="7">
        <v-text-field
          v-model="project.title"
          hint="可读性更好的标题"
          label="项目标题"
          required
          variant="outlined"
        ></v-text-field>
      </v-col>
      <v-col cols="12">
        <v-textarea
          v-model="project.description"
          hint="介绍作品类型，玩法，并向对这个作品有帮助的人致谢！"
          label="简介"
          variant="outlined"
        ></v-textarea>
      </v-col>
      <v-col cols="12" sm="6">
        <LanguageSelector
          v-model="project.type"
          hint="不建议你改"
          label="类型"
          required
        />
      </v-col>

      <v-col cols="12" sm="6">
        <LicenseSelector v-model="project.license" />
      </v-col>

      <v-col cols="12">
        <v-combobox
          v-model="tags.chips"
          :items="tags.items"
          chips
          label="标签"
          multiple
          prepend-icon="mdi-tag"
          variant="outlined"
        >
          <template v-slot:selection="{ attrs, item, select, selected }">
            <v-chip
              :model-value="selected"
              closable
              v-bind="attrs"
              @click="select"
              @click:close="removeTag(item)"
            >
              <strong>{{ item.name }}</strong
              >&nbsp;
              <span>(interest)</span>
            </v-chip>
          </template>
        </v-combobox>
      </v-col>
      <v-col cols="12">
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text="取消" variant="plain" @click="cancel"></v-btn>
          <v-btn
            color="primary"
            text="保存"
            variant="tonal"
            @click="saveProject"
          ></v-btn>
        </v-card-actions>
      </v-col>
      <v-col cols="12"><h1>图片</h1></v-col>
      <v-col cols="12">
        <v-file-input
          ref="fileInput"
          accept="image/*"
          label="上传封面"
          prepend-icon="mdi-image"
          variant="outlined"
          @change="onFileChange"
        ></v-file-input>
        <v-img v-if="thumbnail" :src="thumbnail" max-width="200"></v-img>
        <v-btn
          :disabled="!thumbnail"
          color="primary"
          text="上传封面"
          variant="tonal"
          @click="uploadThumbnail"
        ></v-btn>
      </v-col>
      <v-col cols="12"><h1>云变量</h1></v-col>
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <div
              class="d-flex align-center justify-space-between flex-wrap ga-2"
            >
              <div>
                <div class="text-subtitle-1">匿名读取</div>
                <div class="text-body-2 text-medium-emphasis">
                  允许未登录用户存取云变量数据。
                </div>
              </div>
              <v-switch
                v-model="cloudConfig.anonymouswrite"
                :disabled="cloudConfigLoading || !isAuthor"
                inset
                color="primary"
                @update:model-value="updateCloudConfig"
              />
            </div>
          </v-card-text>
        </v-card>        <v-card
          v-if="cloudConfig.anonymouswrite"
          :to="'/app/docs/cloud-variables?projectid=' + project.id"
          append-icon="mdi-arrow-right"
          title="查看如何使用"
        ></v-card>
        <v-card class="mt-4">
          <v-card-text>
            <div
              class="d-flex align-center justify-space-between flex-wrap ga-2"
            >
              <div>
                <div class="text-subtitle-1">历史记录</div>
                <div class="text-body-2 text-medium-emphasis">
                  关闭后无法读取历史记录，且不再写入历史记录。
                </div>
              </div>
              <v-switch
                v-model="cloudConfig.historyenabled"
                :disabled="cloudConfigLoading || !isAuthor"
                inset
                color="primary"
                @update:model-value="updateCloudConfig"
              />
            </div>
          </v-card-text>
        </v-card>


      </v-col>

      <v-col cols="12"><h1>危险</h1></v-col>
      <v-col cols="12">
        <v-card>
          <v-list>
            <v-list-item subtitle="删除此项目后无法恢复。" title="删除此项目">
              <template v-slot:append>
                <v-btn
                  color="error"
                  text="删除此项目"
                  variant="tonal"
                  @click="confirmDelete = true"
                ></v-btn>
              </template>
            </v-list-item>
            <v-list-item
              subtitle="选择项目的可见性，公开或私密。"
              title="更改项目可见性"
            >
              <template v-slot:append>
                <v-btn
                  color="error"
                  text="更改项目可见性"
                  variant="tonal"
                  @click="changeVisibility = true"
                ></v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>详细数据</v-expansion-panel-title>
        <v-expansion-panel-text>
          {{ project }}
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-dialog v-model="confirmDelete" max-width="500px">
      <v-card>
        <v-card-title class="headline">删除 {{ project.title }}</v-card-title>
        <v-card-text
          >你确定要删除这个项目吗？此操作无法撤销。<br />这将永久删除
          {{ project.title }}
          项目、推送、Star、评论、和其他所有数据，移除Fork对此项目的关联（但不会删除Fork）。<br />要确认，请在下面的框中输入提示的小字以确认您的操作。
          <br /><br />
          <v-text-field
            v-model="confirmDeleteText"
            :label="`${localuser.user.username}/${project.name}`"
            variant="outlined"
          ></v-text-field>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            text
            @click="
              confirmDelete = false;
              confirmDeleteText = '';
            "
            >取消
          </v-btn>
          <v-btn
            :disabled="
              confirmDeleteText !== `${localuser.user.username}/${project.name}`
            "
            color="error"
            text
            @click="deleteProject"
            >删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="changeVisibility" max-width="500px">
      <v-card>
        <v-card-title class="headline"
          >要将{{ project.title }}设为{{ project.state === "public" ? "私密" : "公开" }}吗？
          </v-card-title
        >
        <v-card-text>
          <v-if v-if="project.state === 'public'">
            将此仓库设为私有将删除不再有权访问此仓库的用户的
            star。如果您决定在将来公开此存储库，则无法恢复这些 star
            ，这将影响项目的排名。<br />
            此项目的Fork将保持公开，且不再与此项目有任何关联。
          </v-if>
          <v-if v-if="project.state === 'private'">
            该项目将对可以访问ZeroCat的每个人都可见<br />
            任何人都可以复制或下载您的仓库。<br />
            您的操作历史记录和日志将对所有人可见。
          </v-if>
          <br /><br />
          要确认，请在下面的框中输入 <code>{{localuser.user.username}}/{{project.name}}</code> 以确认您的操作。
          <br /><br />
          <v-text-field
            v-model="changeVisibilityText"
            :label="`${localuser.user.username}/${project.name}`"
            variant="outlined"
          ></v-text-field>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="changeVisibility = false"
            >取消
          </v-btn>
          <v-btn
            :disabled="
              changeVisibilityText !==
              `${localuser.user.username}/${project.name}`
            "
            color="error"
            text
            @click="changeProjectVisibility"
            >{{ project.state === "public" ? "设置为私密" : "设置为公开" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import request from "../../../axios/axios";
import { localuser } from "@/services/localAccount";
import { useHead } from "@unhead/vue";
import { getProjectInfoByNamespace } from "@/services/projectService";
import LicenseSelector from "@/components/LicenseSelector.vue";
import LanguageSelector from "@/components/LanguageSelector.vue";
import { useSudoManager } from "@/composables/useSudoManager";

export default {
  components: {
    LicenseSelector,
    LanguageSelector,
  },
  data() {
    return {
      localuser,
      states: [
        { state: "私密", abbr: "private" },
        { state: "公开", abbr: "public" },
      ],
      projectID: this.$route.params.id,
      project: {},
      newProjectName: "",
      tags: {
        items: ["动画", "故事", "音乐", "硬核", "艺术", "水"],
        chips: [],
      },
      cloudConfig: {
        anonymouswrite: false,
        historyenabled: true,
      },
      cloudConfigLoading: false,
      changeVisibility: false,
      changeVisibilityText: "",
      confirmDelete: false,
      confirmDeleteText: "",
      thumbnail: null,
    };
  },
  async created() {
    if (!localuser.isLogin.value) {
      this.$router.push("/app/account/login");
    }
    await this.fetchProject();
    await this.fetchCloudConfig();
  },
  setup() {
    useHead({ title: "项目设置" });
    const sudoManager = useSudoManager();
    return {
      sudoManager,
    };
  },
  methods: {
    removeTag(item) {
      this.tags.chips.splice(this.tags.chips.indexOf(item), 1);
    },
    async fetchProject() {
      try {
        const { username, projectname } = this.$route.params;
        this.project = await getProjectInfoByNamespace(username, projectname);
        this.projectID = this.project.id;
        this.newProjectName = this.project.name;
        this.tags.chips = this.project.tags.map((tag) => tag.name);
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "无法获取项目数据",
          life: 3000,
        });
      }
    },
    normalizeConfigValue(value) {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value === "true";
      if (typeof value === "number") return value !== 0;
      return null;
    },
    applyCloudConfigItem(key, value) {
      if (!key) return;
      const normalizedKey = String(key).toLowerCase();
      const normalizedValue = this.normalizeConfigValue(value);
      if (normalizedValue === null) return;
      if (
        normalizedKey === "anonymouswrite" ||
        normalizedKey === "scratch.clouddata.anonymouswrite"
      ) {
        this.cloudConfig.anonymouswrite = normalizedValue;
      }
      if (
        normalizedKey === "historyenabled" ||
        normalizedKey === "scratch.clouddata.history.enabled"
      ) {
        this.cloudConfig.historyenabled = normalizedValue;
      }
    },
    async fetchCloudConfig() {
      if (!this.projectID) return;
      this.cloudConfigLoading = true;
      try {
        const res = await request.get(
          `/project/id/${this.projectID}/cloudconfig`,
        );
        const payload = res?.data ?? {};
        const data = payload?.data;
        if (Array.isArray(data)) {
          data.forEach((item) => {
            const key =
              item?.key ??
              item?.name ??
              item?.config ??
              item?.config_key ??
              item?.path;
            const value =
              item?.value ?? item?.raw_value ?? item?.rawValue ?? item?.data;
            this.applyCloudConfigItem(key, value);
          });
        } else if (data && typeof data === "object") {
          const key =
            data?.key ?? data?.name ?? data?.config ?? data?.config_key;
          const value = data?.value ?? data?.raw_value ?? data?.rawValue;
          if (key) {
            this.applyCloudConfigItem(key, value);
          } else {
            Object.entries(data).forEach(([entryKey, entryValue]) => {
              this.applyCloudConfigItem(entryKey, entryValue);
            });
          }
        }
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "加载云变量配置失败",
          life: 3000,
        });
      } finally {
        this.cloudConfigLoading = false;
      }
    },
    async updateCloudConfig() {
      if (!this.projectID) return;
      this.cloudConfigLoading = true;
      try {
        const response = (
          await request.put(`/project/id/${this.projectID}/cloudconfig`, {
            anonymouswrite: !!this.cloudConfig.anonymouswrite,
            historyenabled: !!this.cloudConfig.historyenabled,
          })
        ).data;
        if (response?.status && response.status !== "success") {
          throw new Error(response?.message || "更新失败");
        }
        this.$toast.add({
          severity: "success",
          summary: "成功",
          detail: "云变量配置已更新",
          life: 3000,
        });
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "更新云变量配置失败",
          life: 3000,
        });
        await this.fetchCloudConfig();
      } finally {
        this.cloudConfigLoading = false;
      }
    },
    async deleteProject() {
      try {
        const sudoToken = await this.sudoManager.requireSudo({
          title: "删除项目",
          subtitle: `您正在尝试删除项目 ${this.project.name}。此操作不可逆，请输入密码以确认。`,
          persistent: true,
        });

        await request.delete(`/project/${this.projectID}`, {
          headers: {
            "X-Sudo-Token": sudoToken,
          },
        });
        this.$toast.add({
          severity: "info",
          summary: "成功",
          detail: "项目已删除",
          life: 3000,
        });
        this.$router.push("/app/explore");
      } catch (error) {
        console.error(error);
        if (error.type !== "cancel") {
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: "删除项目失败",
            life: 3000,
          });
        }
      }
    },
    async saveProject() {
      this.project.tags = this.tags.chips.map((name) => name);
      try {
        const response = (
          await request.put(
            `/project/id/${this.projectID}`,

            {
              id: this.project.id,
              title: this.project.title,
              description: this.project.description,
              type: this.project.type,
              tags: this.project.tags,
              license: this.project.license,
            },
          )
        ).data;
        this.$toast.add({
          severity: response.status,
          summary: response.message,
          detail: response.message,
          life: 3000,
        });
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "保存项目失败",
          life: 3000,
        });
      }
    },
    async renameProject() {
      try {
        const response = (
          await request.put(`/project/rename/${this.projectID}`, {
            newName: this.newProjectName,
          })
        ).data;
        this.$toast.add({
          severity: response.status,
          summary: response.message,
          detail: response.message,
          life: 3000,
        });
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "修改项目名称失败",
          life: 3000,
        });
      }
    },
    async changeProjectVisibility() {
      try {
        // 请求sudo认证
        const sudoToken = await this.sudoManager.requireSudo({
          title: "更改项目可见性",
          subtitle: `您正在将项目"${this.project.name}"的可见性从${this.project.state === "public" ? "公开" : "私密"}更改为${this.project.state === "public" ? "私密" : "公开"}。此操作需要验证您的身份。`,
          persistent: true,
        });

        const response = (
          await request.put(
            `/project/changevisibility/${this.projectID}`,
            {
              newState: this.project.state === "public" ? "private" : "public",
            },
            {
              headers: {
                "X-Sudo-Token": sudoToken,
              },
            },
          )
        ).data;
        this.$toast.add({
          severity: response.status,
          summary: response.message,
          detail: response.message,
          life: 3000,
        });
        this.$router.push(
          `/${localuser.user.value.username}/${this.project.name}`,
        );
      } catch (error) {
        if (error.type !== "cancelled") {
          console.error(error);
          this.$toast.add({
            severity: "error",
            summary: "错误",
            detail: "修改项目状态失败",
            life: 3000,
          });
        }
      }
    },
    cancel() {
      this.$router.push("/app/explore");
    },
    onFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        this.thumbnail = URL.createObjectURL(file);
      }
    },
    async uploadThumbnail() {
      const formData = new FormData();
      formData.append(
        "file",
        this.$refs.fileInput.$el.querySelector("input").files[0],
      );
      try {
        await request.post(`/scratch/thumbnail/${this.projectID}`, formData, {
          headers: {
            Authorization: `Bearer ${localuser.token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        this.$toast.add({
          severity: "success",
          summary: "成功",
          detail: "封面上传成功",
          life: 3000,
        });
      } catch (error) {
        console.error(error);
        this.$toast.add({
          severity: "error",
          summary: "错误",
          detail: "封面上传失败",
          life: 3000,
        });
      }
    },
  },
  computed: {
    isAuthor() {
      return (
        Number(this.project?.authorid) === Number(localuser.user.value?.id)
      );
    },
  },
};
</script>
