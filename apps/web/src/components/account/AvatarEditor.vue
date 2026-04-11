<template>
  <v-row>
    <v-col cols="12" md="6">
      <v-file-input
        :rules="[
          v => (!v || !v.length || v[0].size < 2000000) || '头像大小不能超过2MB'
        ]"
        accept="image/*"
        density="comfortable"
        label="上传头像"
        placeholder="选择图片上传"
        prepend-icon="mdi-camera"
        show-size
        variant="outlined"
        @change="onFileChange"
      ></v-file-input>
      <div class="text-caption text-medium-emphasis">图片将被自动压缩</div>
    </v-col>
    <v-col class="d-flex align-center justify-center" cols="12" md="6">
      <v-sheet
        :class="['rounded-lg overflow-hidden', 'elevation-2']"
        height="150"
        width="150"
      >
        <v-img
          :src="previewImage || ( localuser.getUserAvatar())"
          class="bg-grey-lighten-3"
          cover
          height="150"
          width="150"
        >
          <template v-slot:placeholder>
            <div class="d-flex align-center justify-center fill-height">
              <v-icon color="grey-darken-1" icon="mdi-image" size="64"></v-icon>
            </div>
          </template>
        </v-img>
      </v-sheet>
    </v-col>
    <v-col cols="12">
      <v-btn
        :disabled="!avatarFile"
        :loading="loading"
        class="px-6"
        color="primary"
        prepend-icon="mdi-cloud-upload"
        size="large"
        @click="uploadAvatar"
      >
        上传头像
      </v-btn>
    </v-col>
  </v-row>
</template>

<script>
import {uploadUserAvatar} from "@/services/accountService";
import { localuser } from "@/services/localAccount";
export default {
  name: "AvatarEditor",
  props: {
    userData: {
      type: Object,
      required: true
    },
    s3BucketUrl: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      avatarFile: null,
      previewImage: null,
      localuser,
    };
  },
  methods: {
    async onFileChange(event) {
      const file = event.target.files ? event.target.files[0] : null;
      if (file instanceof File && file.type.startsWith("image/")) {
        const { default: Compressor } = await import("compressorjs");
        new Compressor(file, {
          quality: 0.8,
          maxWidth: 500,
          maxHeight: 500,
          success: (compressedFile) => {
            this.previewImage = URL.createObjectURL(compressedFile);
            this.avatarFile = compressedFile;
          },
          error: (err) => {
            console.error("图片压缩出错：", err.message);
            this.$emit('error', {
              message: "图片压缩出错：" + err.message
            });
          },
        });
      } else if (file) {
        this.$emit('error', {
          message: "请选择有效的图片文件"
        });
      }
    },
    async uploadAvatar() {
      if (!this.avatarFile) return;

      this.loading = true;
      try {
        const formData = new FormData();
        formData.append("zcfile", this.avatarFile);

        const response = await uploadUserAvatar("", formData);
        this.$emit('avatar-updated', response);

        // Reset after successful upload
        this.avatarFile = null;
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
