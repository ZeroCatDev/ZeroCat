<template>
  <v-dialog v-model="show" max-width="400px">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <p>验证码将发送到邮箱 {{ email }}</p>
        <v-text-field v-model="verifyCode" :rules="[rules.required, rules.length]" class="mt-4" label="验证码"
                      maxlength="6" variant="outlined"></v-text-field>
        <v-alert v-if="message" :type="messageType" class="mt-3" variant="tonal">
          {{ message }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="close">取消</v-btn>
        <v-btn :loading="isLoading" color="primary" @click="confirm">
          确认
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import {ref} from 'vue'
import axios from '@/axios/axios'

const props = defineProps({
  modelValue: Boolean,
  email: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '验证邮箱'
  }
})

const emit = defineEmits(['update:modelValue', 'verified'])

const show = ref(props.modelValue)
const verifyCode = ref('')
const message = ref('')
const messageType = ref('info')
const isLoading = ref(false)

const rules = {
  required: value => !!value || '此字段为必填项',
  length: value => value?.length === 6 || '验证码必须是6位数字'
}

// 监听 show 变化
watch(() => show.value, (val) => {
  emit('update:modelValue', val)
  if (val) {
    // 打开对话框时自动发送验证码
    sendCode()
  }
})

// 监听 modelValue 变化
watch(() => props.modelValue, (val) => {
  show.value = val
})

const sendCode = async () => {
  message.value = ''
  isLoading.value = true
  try {
    const response = await axios.post('/account/send-verification-code', {
      email: props.email
    })

    if (response.data.status === 'success') {
      message.value = '验证码已发送'
      messageType.value = 'success'
    } else {
      message.value = response.data.message
      messageType.value = 'error'
    }
  } catch (error) {
    message.value = error.response?.data?.message || '发送验证码失败'
    messageType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const confirm = () => {
  if (!verifyCode.value || verifyCode.value.length !== 6) {
    message.value = '请输入6位验证码'
    messageType.value = 'error'
    return
  }

  emit('verified', verifyCode.value)
  close()
}

const close = () => {
  show.value = false
  verifyCode.value = ''
  message.value = ''
}

// 暴露方法供父组件调用
defineExpose({
  sendCode
})
</script>
