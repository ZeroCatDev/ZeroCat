import { ref } from 'vue';

export const postDialogVisible = ref(false);

export const openPostDialog = () => {
  postDialogVisible.value = true;
};

export const closePostDialog = () => {
  postDialogVisible.value = false;
};
