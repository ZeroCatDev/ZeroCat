import axios from '@/axios/axios';
import { localuser } from '@/services/localAccount';

const TwoFAService = {
  async getStatus() {
    const { data } = await axios.get('/account/2fa/status');
    return data;
  },

  async setup(sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/2fa/setup', {}, { headers });
    return data;
  },

  async activate(token, sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/2fa/activate', { token }, { headers });
    return data;
  },

  async disable(sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/2fa/disable', {}, { headers });
    return data;
  },

  async loginTotp(challengeId, token) {
    const { data } = await axios.post('/account/2fa/login/totp', { challenge_id: challengeId, token });
    if (data?.status === 'success' && data.token) {
      await localuser.setUser({
        token: data.token,
        expires_at: data.expires_at,
        refresh_expires_at: data.refresh_expires_at,
      });
    }
    return data;
  },
};

export default TwoFAService;


