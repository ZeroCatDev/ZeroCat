import axios from '@/axios/axios';
import { localuser } from '@/services/localAccount';

const PasskeyService = {
  async beginRegistration(sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/passkey/begin-registration', {}, { headers });
    return data;
  },

  async finishRegistration(credential, sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/passkey/finish-registration', credential, { headers });
    return data;
  },

  async list() {
    const { data } = await axios.get('/account/passkey/list');
    return data;
  },

  async deleteCredential(credentialId, sudoToken) {
    const headers = {};
    if (sudoToken) headers['X-Sudo-Token'] = sudoToken;
    const { data } = await axios.post('/account/passkey/delete', { credential_id: credentialId }, { headers });
    return data;
  },

  async beginLogin(identifier) {
    const payload = {};
    if (identifier) payload.identifier = identifier;
    const { data } = await axios.post('/account/passkey/begin-login', payload);
    return data;
  },

  async finishLogin(assertion) {
    const { data } = await axios.post('/account/passkey/finish-login', assertion);
    if (data?.status === 'success' && data.token) {
      await localuser.setUser({
        token: data.token,
        expires_at: data.expires_at,
        refresh_expires_at: data.refresh_expires_at,
      });
    }
    return data;
  },

  async sudoBegin() {
    const { data } = await axios.post('/account/passkey/sudo-begin');
    return data;
  },

  async sudoFinish(assertion) {
    const { data } = await axios.post('/account/passkey/sudo-finish', assertion);
    return data;
  },
};

export default PasskeyService;


