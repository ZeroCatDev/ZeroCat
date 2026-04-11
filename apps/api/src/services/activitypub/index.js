/**
 * ActivityPub 模块入口
 * 导出所有 AP 功能的统一接口
 */

// 配置
export {
    AP_CONTEXT, AP_CONTENT_TYPE, AP_ACCEPT_TYPES,
    getInstanceDomain, getInstanceBaseUrl, getApEndpointBaseUrl, getStaticUrl,
    isFederationEnabled, isAutoAcceptFollows, isApRequest,
    TARGET_TYPES, CACHE_KV_KEYS, CONFIG_KEYS,
} from './config.js';

// 数据存储
export {
    getApUserConfig, setApUserConfig,
    addRemoteFollower, removeRemoteFollower,
    getRemoteFollowers, countRemoteFollowers, isRemoteFollower,
    storeActivity, getActivity, deleteActivity,
    setPostApRef, getPostApId,
    cacheRemoteActor, getCachedRemoteActor,
    recordDelivery, isDelivered, getDeliveryRecords,
} from './store.js';

// 密钥管理
export {
    getUserKeyPair, getUserPublicKey, getUserPrivateKey,
    getInstanceKeyPair,
} from './keys.js';

// HTTP Signature
export {
    signRequest, verifySignature, digestBody, verifyDigest,
    parseSignatureHeader,
} from './httpSignature.js';

// Actor
export {
    buildActorObject, getLocalUserByUsername, getLocalUserById,
    getActorUrl, getActorKeyId,
} from './actor.js';

// 对象序列化
export {
    postToNote, getNoteId, getNoteUrl, generateActivityId,
    getCardUrl,
    buildCreateActivity, buildDeleteActivity, buildLikeActivity,
    buildUndoActivity, buildAnnounceActivity, buildFollowActivity,
    buildAcceptActivity, buildRejectActivity, buildUpdateActivity,
    buildOrderedCollection, buildOrderedCollectionPage,
} from './objects.js';

// 联邦
export {
    fetchRemoteActor, resolveWebFinger,
    getInboxUrl, getSharedInboxUrl,
    getPublicKeyFromActor, fetchPublicKeyByKeyId,
    collectInboxes,
} from './federation.js';

// 投递
export {
    deliverActivity, deliverToFollowers, deliverToActor,
} from './delivery.js';

// 收件箱
export {
    verifyInboxRequest, processInboxActivity,
} from './inbox.js';

// 发件箱
export {
    syncPostToActivityPub, buildUserOutbox, backfillPostsToFollower,
} from './outbox.js';

// 远程用户代理
export {
    ensureProxyUser, findProxyUserByActorUrl, findProxyUserByRemoteUsername,
    resolveAndEnsureProxyUser, isRemoteProxyUser,
    getProxyUserActorUrl, getProxyUserInbox, getProxyUserSharedInbox,
    getRemoteUserInfo, getRemoteFollowCounts, listProxyUsers, searchProxyUsers,
    REMOTE_USER_TYPE,
} from './remoteUser.js';

// 远程媒体缓存（头像/横幅同步到本地 S3）
export {
    cacheRemoteImage, cacheActorMedia,
} from './remoteMedia.js';

// 联邦实例配置（白名单/黑名单）
export {
    getInstancePolicy, getAllowedInstances, getBlockedInstances,
    isInstanceAllowed, isActorAllowed,
    setInstancePolicy, setAllowedInstances, setBlockedInstances,
    addAllowedInstance, removeAllowedInstance,
    addBlockedInstance, removeBlockedInstance,
    isRemoteSearchAllowed, isAutoFetchPostsEnabled, getMaxFetchPosts,
    getFederationConfig, FEDERATION_CONFIG_KEYS,
} from './federationConfig.js';

// 关注同步
export {
    syncFollowToRemote, syncUnfollowToRemote,
    handleFollowAccepted, handleFollowRejected,
    getOutboundFollows,
} from './followSync.js';

// 远程帖子管理
export {
    fetchRemoteUserPosts, findPostByApId,
    handleIncomingNote, handleIncomingAnnounce,
    handleIncomingLike, handleIncomingUndoLike, handleIncomingDelete,
    getRemoteUserLocalPosts,
} from './remotePosts.js';

// 远程搜索
export {
    federatedUserSearch, searchByActorUrl, parseFediAddress,
} from './remoteSearch.js';
