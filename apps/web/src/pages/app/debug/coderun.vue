<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">CodeRun 调试</h1>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex align-center">
            代码编辑器
            <v-spacer></v-spacer>
            <v-select
              v-model="selectedLanguage"
              :items="languageItems"
              class="language-select"
              density="compact"
              label="选择语言"
              style="max-width: 200px"
              variant="outlined"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <v-icon :icon="item.raw.icon"></v-icon>
                  </template>
                </v-list-item>
              </template>
              <template v-slot:selection="{ item }">
                <v-icon :icon="item.raw.icon" class="mr-2"></v-icon>
                {{ item.raw.title }}
              </template>
            </v-select>
          </v-card-title>

          <v-card-text>
            <v-textarea
              v-model="code"
              :placeholder="getPlaceholder(selectedLanguage)"
              :rows="10"
              class="font-monospace"
              variant="outlined"
            ></v-textarea>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="loadSample">加载示例</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <code-run-terminal
          ref="terminal"
          :auto-run="false"
          :code="code"
          :language="selectedLanguage"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { defineAsyncComponent } from "vue";
import programmingLanguages from "@/constants/programming_languages.js";

const CodeRunTerminal = defineAsyncComponent(() =>
  import("@/components/admin/CodeRunTerminal.vue")
);

export default {
  name: "CodeRunDebug",

  components: {
    CodeRunTerminal,
  },

  data() {
    return {
      code: "",
      selectedLanguage: "python",
      languageItems: Object.entries(programmingLanguages).map(([id, lang]) => ({
        title: lang.name,
        value: id,
        icon: lang.icon,
      })),
    };
  },

  methods: {
    getPlaceholder(language) {
      return programmingLanguages[language]?.placeholder || "Enter code here";
    },

    loadSample() {
      this.code = programmingLanguages[this.selectedLanguage]?.sample || "";
    },
  },
};
</script>

<style scoped>
.language-select {
  min-width: 150px;
}

.font-monospace {
  font-family: "Menlo", "Monaco", "Courier New", monospace;
}
</style>
