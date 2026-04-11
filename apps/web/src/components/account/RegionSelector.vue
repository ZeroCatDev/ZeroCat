<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-item>
        <v-card-title class="text-h5">
          选择区域
        </v-card-title>
        <template v-slot:append>
          <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)"></v-btn>
        </template>
      </v-card-item>

      <v-card-text class="pa-4">
        <v-text-field
          v-model="regionSearch"
          class="mb-4"
          clearable
          density="comfortable"
          hide-details
          label="搜索区域"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
        ></v-text-field>

        <v-list class="region-list" lines="two">
          <v-list-item
            v-for="region in filteredRegions"
            :key="region.value"
            :subtitle="region.value"
            :title="region.text"
            @click="selectRegion(region)"
          >
            <template v-slot:prepend>
              <v-icon :color="selectedRegion?.value === region.value ? 'primary' : undefined">
                {{ selectedRegion?.value === region.value ? 'mdi-check-circle' : 'mdi-earth' }}
              </v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="clearRegion"
        >
          清除选择
        </v-btn>
        <v-btn
          color="primary"
          @click="$emit('update:modelValue', false)"
        >
          确定
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import region_zh_CN from "@/constants/region_zh-CN.json";

export default {
  name: "RegionSelector",
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    selectedRegion: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'select', 'clear'],
  data() {
    return {
      regionSearch: '',
      regionOptions: Object.entries(region_zh_CN).map(([value, text]) => ({
        value,
        text
      }))
    };
  },
  computed: {
    filteredRegions() {
      if (!this.regionSearch) return this.regionOptions;

      const search = this.regionSearch.toLowerCase();
      return this.regionOptions.filter(region =>
        region.text.toLowerCase().includes(search) ||
        region.value.toLowerCase().includes(search)
      );
    }
  },
  methods: {
    selectRegion(region) {
      this.$emit('select', region);
      this.$emit('update:modelValue', false);
    },
    clearRegion() {
      this.$emit('clear');
      this.$emit('update:modelValue', false);
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
