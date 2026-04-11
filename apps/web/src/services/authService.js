import axios from '@/axios/axios';
import {localuser} from './localAccount';
import TwoFAService from './twofaService';

export const AuthService = {
  // User registration
  register: async (userData) => {
    try {
      const response = await axios.post('/account/register', userData);
      // Ensure we have the correct data format for our components
      return {
        status: response.data.status,
        message: response.data.message,
        userId: response.data.userId,
        username: response.data.username,
        needVerify: response.data.needVerify || false,
        needPassword: response.data.needPassword || false,
        setupUrl: response.data.setupUrl,
        temporaryToken: response.data.temporaryToken
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Registration failed, please try again.'
      };
    }
  },

  // Password login
  loginWithPassword: async (username, password, captcha = null) => {
    const data = {un: username, pw: password};
    if (captcha) data.captcha = captcha;

    const response = await axios.post('/account/login', data);

    if (response.data.status === 'success') {
      await storeAuthData(response.data);
    }

    return response.data;
  },

  // Request login verification code
  sendLoginCode: async (email, captcha = null) => {
    const data = {email};
    if (captcha) data.captcha = captcha;

    const response = await axios.post('/account/send-login-code', data);
    return response.data;
  },

  // Login with verification code
  loginWithCode: async (email, code) => {
    const response = await axios.post('/account/login-with-code', {
      email,
      code
    });

    if (response.data.status === 'success') {
      await storeAuthData(response.data);
    }

    return response.data;
  },

  // Generate magic link
  generateMagicLink: async (email, redirect = null, captcha = null) => {
    const data = {email};
    if (redirect) data.redirect = redirect;
    if (captcha) data.captcha = captcha;

    const response = await axios.post('/account/magiclink/generate', data);
    return response.data;
  },

  // Password reset - send code
  sendPasswordResetCode: async (email, captcha = null) => {
    const data = {email};
    if (captcha) data.captcha = captcha;

    const response = await axios.post('/account/send-code', data);
    return response.data;
  },

  // Password reset - submit new password with code
  resetPasswordWithCode: async (codeId, code, newPassword) => {
    const response = await axios.post('/account/reset-password', {
      code_id: codeId,
      code,
      new_password: newPassword
    });
    return response.data;
  },

  // Validate magic link
  validateMagicLink: async (token) => {
    const response = await axios.get(`/account/magiclink/validate?token=${token}`);

    if (response.data.status === 'success') {
      await storeAuthData(response.data);
    }

    return response.data;
  },

  // OAuth login/registration
  oauthRedirect: (provider) => {
    const token = localuser.getToken(); // Get current token if exists
    const redirectUrl = `${import.meta.env.VITE_APP_BASE_API}/account/oauth/${provider}?token=${token}`;
    return redirectUrl;
  },

  // Logout
  logout: async () => {
    return localuser.logout();
  },

  // Refresh token
  refreshToken: async () => {
    try {
      const response = await axios.post('/account/refresh-token');

      if (response.data.status === 'success') {
        localuser.updateToken(response.data.token, response.data.expires_at);
      }

      return response.data;
    } catch (error) {
      return {status: 'error', message: 'Failed to refresh token'};
    }
  },

  // Add new registration and verification methods
  resendVerificationEmail: async (token) => {
    try {
      const response = await axios.post('/account/register/resend-verification-email', {token});
      return {
        status: response.data.status,
        message: response.data.message,
        expiresIn: response.data.expiresIn,
        temporaryToken: response.data.temporaryToken
      };
    } catch (error) {
      console.error('Error resending verification email:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to resend verification email, please try again.'
      };
    }
  },

  changeRegisterEmail: async (token, email) => {
    try {
      const response = await axios.post('/account/register/change-register-email', {token, email});
      return {
        status: response.data.status,
        message: response.data.message,
        email: response.data.email,
        temporaryToken: response.data.temporaryToken
      };
    } catch (error) {
      console.error('Error changing email:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to change email, please try again.'
      };
    }
  },

  verifyEmail: async (email, code) => {
    try {
      const response = await axios.post('/account/verify-email', {email, code});
      return {
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error verifying email:', error);
      return {
        status: 'error',
        message: error.response?.data?.message || 'Failed to verify email, please try again.'
      };
    }
  }
};

// Helper function to store authentication data
async function storeAuthData(data) {
  await localuser.setUser({
    token: data.token,
    expires_at: data.expires_at,
    refresh_expires_at: data.refresh_expires_at
  });
  return true;
}

export default AuthService;
