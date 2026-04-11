import axios from '@/axios/axios';

export const SudoService = {
  /**
   * 获取可用的认证方法
   * @param {string} purpose - 认证目的 (login, sudo, reset_password)
   * @returns {Promise<Object>}
   */
  getAuthMethods: async (purpose = 'sudo') => {
    try {
      const response = await axios.get(`/auth/methods?purpose=${purpose}`);
      return response.data;
    } catch (error) {
      console.error('获取认证方法失败:', error);
      throw error;
    }
  },

  /**
   * TOTP 认证
   * @param {string} code - 6位TOTP验证码
   * @param {string} purpose - 认证目的
   * @returns {Promise<Object>}
   */
  authenticateWithTotp: async (code, purpose = 'sudo') => {
    return await SudoService.authenticate({
      method: 'totp',
      purpose,
      code
    });
  },

  /**
   * 发送验证码
   * @param {string} email - 邮箱地址
   * @param {string} purpose - 认证目的
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>}
   */
  sendVerificationCode: async (email, purpose = 'sudo', userId = null) => {
    try {
      const data = { email, purpose };
      if (userId) data.userId = userId;

      const response = await axios.post('/auth/send-code', data);
      return response.data;
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw error;
    }
  },

  /**
   * 统一认证接口
   * @param {Object} authData - 认证数据
   * @returns {Promise<Object>}
   */
  authenticate: async (authData) => {
    try {
      const response = await axios.post('/auth/authenticate', authData);
      return response.data;
    } catch (error) {
      console.error('认证失败:', error);
      throw error;
    }
  },

  /**
   * 密码认证
   * @param {string} identifier - 用户名或邮箱
   * @param {string} password - 密码
   * @param {string} purpose - 认证目的
   * @returns {Promise<Object>}
   */
  authenticateWithPassword: async (identifier, password, purpose = 'sudo') => {
    return await SudoService.authenticate({
      method: 'password',
      purpose,
      identifier,
      password
    });
  },

  /**
   * 邮箱验证码认证
   * @param {string} codeId - 验证码ID
   * @param {string} code - 验证码
   * @param {string} purpose - 认证目的
   * @returns {Promise<Object>}
   */
  authenticateWithEmail: async (codeId, code, purpose = 'sudo') => {
    return await SudoService.authenticate({
      method: 'email',
      purpose,
      code_id: codeId,
      code
    });
  }
};

export default SudoService;
