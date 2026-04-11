<template>
  <div>
    <div v-if="showNormal" :id="recaptchaId"></div>
    <v-btn v-if="showNormal" variant="text" @click="resetCaptcha">刷新</v-btn>
  </div>
</template>

<script>
import "https://static.geetest.com/v4/gt4.js";
import {get} from '@/services/serverConfig';

export default {
  props: {
    recaptchaId: {
      type: String,
      required: true,
    },
    product: {
      type: String,
      default: "popup",
    },
    showNormal: {
      type: Boolean,
      default: true,
    }
  },
  data() {
    return {
      captchaObj: null,
      bindCaptchaObj: null,
      geeId: '',
    };
  },
  async mounted() {
    this.geeId = get('captcha.GEE_CAPTCHA_ID');
    console.log(this.geeId);
    if (this.showNormal) {
      this.initRecaptcha();
    }
  },
  watch: {
    showNormal(newValue) {
      if (newValue) {
        this.initRecaptcha(); // 当 showNormal 变为 true 时重新初始化验证码
      }
    }
  },
  methods: {
    initRecaptcha() {
      initGeetest4(
        {
          captchaId: this.geeId,
          product: this.product,
        },
        (captchaObj) => {
          this.captchaObj = captchaObj;
          window.gt4 = captchaObj;
          captchaObj.appendTo(`#${this.recaptchaId}`);
          captchaObj
            .onReady(() => {
              console.log(`Challenge Ready`);
            })
            .onSuccess(() => {
              console.log(`Challenge Success`);
            })
            .onError(() => {
              console.log(`Challenge Error`);
            });
        }
      );
    },
    initBindRecaptcha() {
      initGeetest4(
        {
          captchaId: this.geeId,
          product: 'bind',
          mask: {
            outside: true,
            bgColor: "#0000004d",
          },
        },
        (captchaObj) => {
          this.bindCaptchaObj = captchaObj;
          captchaObj
            .onReady(() => {
              console.log(`Bind Challenge Ready`);
            })
            .onSuccess(() => {
              console.log(`Bind Challenge Success`);
              this.$emit('bindVerified', this.getBindResponse());
            })
            .onError(() => {
              console.log(`Bind Challenge Error`);
              this.$emit('bindError');
            })
            .onClose(() => {
              console.log(`Bind Challenge Closed`);
              this.$emit('bindClose');
            });
        }
      );
    },
    resetCaptcha() {
      if (this.captchaObj) {
        this.captchaObj.reset();
      } else {
        this.initRecaptcha(); // 重新加载验证码作为后备策略
      }
    },
    getResponse() {
      return this.captchaObj?.getValidate();
    },
    getBindResponse() {
      return this.bindCaptchaObj?.getValidate();
    },
    showBindCaptcha() {
      if (!this.bindCaptchaObj) {
        this.initBindRecaptcha();
      } else {
        this.bindCaptchaObj.showBox();
      }
    },
  },
};
</script>
