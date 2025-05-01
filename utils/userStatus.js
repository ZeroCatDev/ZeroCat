/**
 * User status code constants and helper functions
 */

// Status string constants
export const USER_STATUS = {
  PENDING: 'pending',    // 新注册账户
  ACTIVE: 'active',      // 正常活跃账户
  SUSPENDED: 'suspended', // 暂时停用账户
  BANNED: 'banned'       // 永久封禁账户
};

// Helper functions
export const isActive = (status) => status === USER_STATUS.ACTIVE;
export const isPending = (status) => status === USER_STATUS.PENDING;
export const isSuspended = (status) => status === USER_STATUS.SUSPENDED;
export const isBanned = (status) => status === USER_STATUS.BANNED;
export const isDisabled = (status) => isSuspended(status) || isBanned(status);

// Get status text description (中文)
export const getStatusTextCN = (status) => {
  switch (status) {
    case USER_STATUS.PENDING:
      return '待激活';
    case USER_STATUS.ACTIVE:
      return '正常';
    case USER_STATUS.SUSPENDED:
      return '已暂停';
    case USER_STATUS.BANNED:
      return '已封禁';
    default:
      return '未知';
  }
};

// Get status text description (English)
export const getStatusText = (status) => {
  switch (status) {
    case USER_STATUS.PENDING:
      return 'Pending';
    case USER_STATUS.ACTIVE:
      return 'Active';
    case USER_STATUS.SUSPENDED:
      return 'Suspended';
    case USER_STATUS.BANNED:
      return 'Banned';
    default:
      return 'Unknown';
  }
};

export default {
  USER_STATUS,
  isActive,
  isPending,
  isSuspended,
  isBanned,
  isDisabled,
  getStatusText,
  getStatusTextCN
};