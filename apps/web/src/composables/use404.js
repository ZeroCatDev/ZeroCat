import {ref} from "vue";

const is404 = ref(false);

const show404 = () => {
  is404.value = true;
};

const reset404 = () => {
  is404.value = false;
};

/**
 * 检查路由是否应该显示404页面
 * @param {Object} route - 当前路由对象
 * @returns {boolean} - 是否应该显示404页面
 */
export function use404(route) {
  // 检查是否已经手动设置了404状态
  return is404.value;
}

// 导出辅助方法
export const use404Helper = {
  show404,
  reset404,
  is404,
};
