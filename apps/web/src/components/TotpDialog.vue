<template>
  <v-dialog v-model="internalModel" max-width="420" persistent>
    <v-card>
      <v-card-title class="text-h6 d-flex align-center">
        <v-icon class="mr-2">mdi-shield-key</v-icon>
        {{ title }}
      </v-card-title>
      <v-card-subtitle v-if="subtitle" class="pb-0">{{ subtitle }}</v-card-subtitle>
      <v-card-text>
        <div class="mb-3 text-caption text-medium-emphasis">请输入认证器中的 6 位一次性验证码</div>
        <div class="d-flex justify-center mb-2">
          <v-otp-input
            v-model="otp"
            :length="length"
            :disabled="loading"
            type="number"

            autofocus
            @finish="handleAutoFinish"
          />
        </div>
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="comfortable"
          class="mt-2"
          :text="errorMessage"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="handleCancel" :disabled="loading">取消</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" :disabled="!canConfirm" @click="handleConfirm">确认</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

</template>

<script>

export default {
  name: 'TotpDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'TOTP 验证' },
    subtitle: { type: String, default: '' },
    length: { type: Number, default: 6 },
    loading: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  data() {
    return {
      otp: '',
      internalModel: this.modelValue,
    }
  },
  computed: {
    canConfirm() {
      return !!this.otp && this.otp.length === this.length && !this.loading
    },
  },
  watch: {
    modelValue(val) {
      this.internalModel = val
      if (val === true) this.otp = ''
    },
    internalModel(val) {
      this.$emit('update:modelValue', val)
      if (!val) this.otp = ''
    },
  },
  methods: {
    handleCancel() {
      this.$emit('cancel')
      this.internalModel = false
    },
    handleConfirm() {
      if (!this.canConfirm) return
      this.$emit('confirm', this.otp)
      this.internalModel = false
    },
    handleAutoFinish() {
      // Auto confirm when input length reached
      this.handleConfirm()
    }
  }
}
</script>


