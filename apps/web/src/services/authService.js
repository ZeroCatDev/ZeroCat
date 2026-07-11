import axios, { authClient } from '@/axios/axios';
import {localuser} from './localAccount';

export const AuthService = {
  // Check email/username availability for registration (interactive validation)
  checkRegisterAvailability: async ({email, username} = {}) => {
    try {
      const params = {};
      if (email) params.email = email;
      if (username) params.username = username;
      const response = await axios.get('/account/register/check', {params});
      return response.data?.data || {};
    } catch (error) {
      console.error('Failed to check registration availability:', error);
      return {};
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

  // Query which authentication methods an account supports (adaptive sign-in)
  getAuthMethods: async (identifier, purpose = 'login') => {
    try {
      const response = await axios.get('/auth/methods', {
        params: { purpose, identifier },
      });
      const data = response.data?.data || {};
      return {
        status: response.data?.status || 'success',
        purpose: data.purpose || purpose,
        availableMethods: Array.isArray(data.available_methods) ? data.available_methods : [],
        accountExists: data.account_exists ?? null,
      };
    } catch (error) {
      console.error('Failed to fetch auth methods:', error);
      return {
        status: 'error',
        purpose,
        availableMethods: [],
        accountExists: null,
        message: error.response?.data?.message || 'Failed to fetch auth methods',
      };
    }
  },

  // Email-first registration: begin (email -> login link if exists, else register link; anti-enumeration)
  beginRegister: async (email, captcha = null, redirect = null) => {
    const data = {email};
    if (captcha) data.captcha = captcha;
    if (redirect) data.redirect = redirect;
    const response = await axios.post('/account/register/begin', data);
    return response.data;
  },

  // Validate a registration continuation token -> returns the (already-verified) email
  validateRegisterToken: async (token) => {
    try {
      const response = await axios.get('/account/register/validate-token', {params: {token}});
      return response.data;
    } catch (error) {
      return {
        status: 'error',
        message: error.response?.data?.message || '注册链接无效或已过期',
      };
    }
  },

  // Complete registration with the token + chosen username/password (auto-login on success)
  completeRegister: async (token, username, password) => {
    const response = await axios.post('/account/register/complete', {token, username, password});
    if (response.data.status === 'success' && response.data.token) {
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

  // Password reset - submit new password with the strong-random token from the email link
  resetPasswordWithToken: async (token, newPassword) => {
    const response = await axios.post('/account/reset-password', {
      token,
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
  oauthRedirect: (provider, postLoginRedirect = null) => {
    const token = localuser.getToken(); // Get current token if exists
    let redirectUrl = `${import.meta.env.VITE_APP_BASE_API}/account/oauth/${provider}?token=${token}`;
    if (postLoginRedirect) {
      redirectUrl += `&redirect=${encodeURIComponent(postLoginRedirect)}`;
    }
    return redirectUrl;
  },

  // Logout
  logout: async () => {
    return localuser.logout();
  },

  // Refresh token
  refreshToken: async () => {
    try {
      const token = await authClient.refreshStoredAuthToken();
      if (!token) {
        return { status: 'error', message: 'Failed to refresh token' };
      }
      await localuser.loadUser(true);
      return { status: 'success', token };
    } catch {
      return {status: 'error', message: 'Failed to refresh token'};
    }
  },
};

// Helper function to store authentication data
async function storeAuthData(data) {
  await localuser.setUser({
    token: data.token,
    expires_at: data.expires_at,
    refresh_expires_at: data.refresh_expires_at,
    refresh_token: data.refresh_token ?? null,
  });
  return true;
}

export default AuthService;
