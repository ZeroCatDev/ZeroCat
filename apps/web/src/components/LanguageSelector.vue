<template>
  <div>
    <div class="text-subtitle-2 mb-2 d-flex align-center ga-1">
      <span>{{ label }}</span>
      <span v-if="required" class="text-error">*</span>
    </div>

    <v-row>
      <v-col
        v-for="type in allTypes"
        :key="type.key"
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          :color="modelValue === type.key ? 'primary' : undefined"
          class="pa-4 cursor-pointer fill-height"
          :variant="modelValue === type.key ? 'tonal' : undefined"
          @click="selectLanguage(type.key)"
          border
          hover
        >
          <div class="d-flex align-center">
            <v-icon :icon="type.icon || 'mdi-shape-outline'" class="mr-2"></v-icon>
            <div>
              <div class="text-subtitle-1">{{ type.name }}</div>
              <div class="text-caption">{{ type.description || type.key }}</div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card
          class="pa-4 cursor-pointer fill-height"
          variant="outlined"
          @click="dialog = true"
          border
          hover
        >
          <div class="d-flex align-center">
            <v-icon icon="mdi-dots-horizontal" class="mr-2"></v-icon>
            <div>
              <div class="text-subtitle-1">查看全部</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
<br/>
    <v-dialog v-model="dialog">
      <v-card>
        <v-card-title>完整类型列表</v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col
                v-for="type in allTypes"
                :key="`dialog-${type.key}`"
                cols="12"
                sm="6"
              >
                <v-card
                  :color="modelValue === type.key ? 'primary' : undefined"
                  class="pa-4 cursor-pointer"
                  :variant="modelValue === type.key ? 'tonal' : undefined"
                  @click="selectLanguage(type.key)"
                  border
                  hover
                >
                  <div class="d-flex align-center">
                    <v-icon :icon="type.icon || 'mdi-shape-outline'" class="mr-2"></v-icon>
                    <div>
                      <div class="text-subtitle-1">{{ type.name }}</div>
                      <div class="text-caption">{{ type.description || type.key }}</div>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import specialTypes from "@/constants/special_languages.js";


export default {
  name: "LanguageSelector",
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      default: "选择编程语言",
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      dialog: false,
      specialTypes,
    };
  },
  computed: {
    allTypes() {
      return Object.entries(this.specialTypes)
        .filter(([key]) => !this.isHiddenType(key))
        .map(([key, type]) => ({ key, ...type }));
    },
  },
  methods: {
    isHiddenType(key) {
      const lowered = String(key || "").toLowerCase();
      return (
        lowered === "#sym:programming_languages" ||
        lowered.includes("coderun") ||
        lowered.includes("codderun")
      );
    },
    selectLanguage(key) {
      this.$emit("update:modelValue", key);
      this.dialog = false;
    },
  },
};
</script>
