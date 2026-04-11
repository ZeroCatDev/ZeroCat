<template>
  <div>
    <v-text-field
      :model-value="selectedLicenseTitle"
      :variant="variant"
      :label="label"
      :hint="hint"
      readonly
      @click="dialog = true"
    ></v-text-field>
    <v-dialog v-model="dialog">
      <v-card>
        <v-card-title>
          <span class="headline">选择许可证</span>
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="search"
            label="搜索许可证"
            class="mb-4"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            hide-details
            single-line
            clearable
          ></v-text-field
          ><v-row
            ><v-col
              cols="6"
              md="6"
              lg="6"
              xl="6"
              v-for="license in filteredLicenses"
              :key="license.value"
            >
              <v-card
              :variant="selectedLicense === license.value ? 'tonal' : ''"
                :color="selectedLicense === license.value ? 'primary' : ''"
                @click.stop.prevent="dialog = false"
              @click="selectLicense(license.value)"
                :title="license.text"
                :subtitle="license['spdx-id']"
                border
                hover
                ><v-card-text>{{ license.description }}</v-card-text></v-card
              >
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" text @click="dialog = false">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <p v-if="showHelp" class="text-caption text-medium-emphasis">
      许可证告诉其他人他们可以和不能使用您的代码。
      <a
        href="https://docs.github.com/zh/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository"
        target="_blank"
        >了解有关许可证的更多信息</a
      >
      或<a href="https://choosealicense.com/" target="_blank">选择一个许可证</a
      >。
    </p>
  </div>
</template>

<script>
import licenses from "@/components/license/licenses.json";

export default {
  name: "LicenseSelector",
  props: {
    modelValue: {
      type: String,
      default: "",
    },
    variant: {
      type: String,
      default: "outlined",
    },
    label: {
      type: String,
      default: "许可证",
    },
    hint: {
      type: String,
      default: "选择适合您项目的许可证",
    },
    showHelp: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      dialog: false,
      search: "",
      allLicenses: [],
    };
  },
  computed: {
    selectedLicense: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
    selectedLicenseTitle() {
      const selected = this.allLicenses.find(
        (l) => l.value === this.selectedLicense
      );
      return selected ? selected.text : "None";
    },
    filteredLicenses() {
      if (!this.search) {
        return this.allLicenses;
      }
      const searchLower = this.search.toLowerCase();
      return this.allLicenses.filter((license) => {
        return (
          license.text.toLowerCase().includes(searchLower) ||
          (license.description &&
            license.description.toLowerCase().includes(searchLower))
        );
      });
    },
  },
  created() {
    this.allLicenses = [
      { text: "None", value: "", description: "不选择或未选择许可证，这意味着您不向任何人授予任何权利，或者您无权继续向任何人授予权利。" },
      ...Object.entries(licenses).map(([key, value]) => ({
        text: value.title,
        value: key,
        description: value.description,
        "spdx-id": value["spdx-id"],
        ...value,
      })),
    ];
  },
  methods: {
    selectLicense(licenseValue) {
      this.selectedLicense = licenseValue;
      this.dialog = false;
    },
  },
};
</script>
