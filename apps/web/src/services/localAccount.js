import { useAuthStore } from "@/stores/auth";
import { storeToRefs } from "pinia";
import pinia from "@/stores";

const store = useAuthStore(pinia);
const {
  user,
  isLogin,
  devices,
  activeTokens,
  currentTokenDetails,
} = storeToRefs(store);

export const localuser = {
  // Reactive refs — consumers use .value (e.g. localuser.isLogin.value)
  // storeToRefs returns proper refs that preserve .value access pattern
  get user() {
    return user;
  },
  get isLogin() {
    return isLogin;
  },

  // Original functions
  loadUser: (...args) => store.loadUser(...args),
  setUser: (...args) => store.setUser(...args),
  logout: (...args) => store.logout(...args),
  getToken: () => store.getToken(),
  updateToken: (...args) => store.updateToken(...args),
  getUserAvatar: (...args) => store.getUserAvatar(...args),
  refreshAccessToken: () => store.refreshAccessToken(),
  logoutAllDevices: () => store.logoutAllDevices(),
  getDevices: () => store.getDevices(),
  getActiveTokens: (...args) => store.getActiveTokens(...args),
  getTokenDetails: (...args) => store.getTokenDetails(...args),
  revokeToken: (...args) => store.revokeToken(...args),

  // New functions
  fetchUserInfo: () => store.fetchUserInfo(),
  isTokenValid: () => store.isTokenValid(),
  isRefreshTokenValid: () => store.isRefreshTokenValid(),
  isAuthenticationNeeded: () => store.isAuthenticationNeeded(),
  getTokenExpirationTime: () => store.getTokenExpirationTime(),
  updateUserProfile: (...args) => store.updateUserProfile(...args),
  changePassword: (...args) => store.changePassword(...args),

  // Backward compatibility aliases
  fetchDevices: () => store.fetchDevices(),
  fetchActiveTokens: (...args) => store.fetchActiveTokens(...args),
  fetchTokenDetails: (...args) => store.fetchTokenDetails(...args),

  // Reactive state refs (storeToRefs preserves .value access)
  get devices() {
    return devices;
  },
  get activeTokens() {
    return activeTokens;
  },
  get currentTokenDetails() {
    return currentTokenDetails;
  },

  // Config
  AUTO_REFRESH_ENABLED: store.AUTO_REFRESH_ENABLED,

  // Token refresh functions
  checkAndRefreshToken: () => store.checkAndRefreshToken(),
  startTokenRefreshTimer: () => store.startTokenRefreshTimer(),
  stopTokenRefreshTimer: () => store.stopTokenRefreshTimer(),
  scheduleTokenRefresh: () => store.scheduleTokenRefresh(),
  initializeTokenRefresh: () => store.initializeTokenRefresh(),

  // Debug
  TokenRefreshScheduler: store.TokenRefreshScheduler,
};
