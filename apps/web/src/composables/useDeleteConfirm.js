import { ref } from 'vue';

const confirmDelete = ref(false);
const deleteCallback = ref(null);
const deleteLoading = ref(false);
const deleteContext = ref({
  title: '删除帖文？',
  message: '这将永久删除此帖文。',
  confirmText: '删除',
  cancelText: '取消'
});

export function useDeleteConfirm() {
  const showDeleteConfirm = (callback, context = {}) => {
    deleteContext.value = {
      title: context.title || '删除帖文？',
      message: context.message || '这将永久删除此帖文。',
      confirmText: context.confirmText || '删除',
      cancelText: context.cancelText || '取消'
    };
    deleteCallback.value = callback;
    confirmDelete.value = true;
  };

  const handleConfirm = async () => {
    if (!deleteCallback.value) return;

    deleteLoading.value = true;
    try {
      await deleteCallback.value();
      confirmDelete.value = false;
    } catch (error) {
      // 错误由回调函数处理
      throw error;
    } finally {
      deleteLoading.value = false;
      deleteCallback.value = null;
    }
  };

  const handleCancel = () => {
    confirmDelete.value = false;
    deleteCallback.value = null;
  };

  return {
    confirmDelete,
    deleteLoading,
    deleteContext,
    showDeleteConfirm,
    handleConfirm,
    handleCancel
  };
}
