import { ref, shallowRef } from 'vue';

// 全局底部悬浮发帖栏展开状态
export const floatingPostBarExpanded = ref(false);

// 初始内容配置
export const floatingPostBarConfig = shallowRef({
  text: '',
  embed: null,
  placeholder: '有什么新鲜事？'
});

export const openFloatingPostBar = (config = {}) => {
  floatingPostBarConfig.value = {
    text: config.text || '',
    embed: config.embed || null,
    placeholder: config.placeholder || '有什么新鲜事？'
  };
  floatingPostBarExpanded.value = true;
};

export const closeFloatingPostBar = () => {
  floatingPostBarExpanded.value = false;
};

export const toggleFloatingPostBar = () => {
  floatingPostBarExpanded.value = !floatingPostBarExpanded.value;
};

export const resetFloatingPostBarConfig = () => {
  floatingPostBarConfig.value = {
    text: '',
    embed: null,
    placeholder: '有什么新鲜事？'
  };
};

export const useFloatingPostBar = () => {
  return {
    isExpanded: floatingPostBarExpanded,
    config: floatingPostBarConfig,
    open: openFloatingPostBar,
    close: closeFloatingPostBar,
    toggle: toggleFloatingPostBar,
    reset: resetFloatingPostBarConfig
  };
};
