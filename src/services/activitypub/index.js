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
