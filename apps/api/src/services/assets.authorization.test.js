import test, { beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const state = {};
const noop = () => {};
mock.module('./logger.js', { defaultExport: { info: noop, warn: noop, error: noop, debug: noop } });
mock.module('./config/zcconfig.js', { defaultExport: { get: async () => '' } });
mock.module('@aws-sdk/client-s3', { namedExports: {
    S3Client: class { async send() { state.s3Writes++; } }, PutObjectCommand: class {}, GetObjectCommand: class {},
} });
mock.module('sharp', { defaultExport: () => { state.imageReads++; throw new Error('Unexpected image processing'); } });
mock.module('fluent-ffmpeg', { defaultExport: () => { throw new Error('Unexpected audio processing'); } });
mock.module('file-type', { namedExports: { fileTypeFromBuffer: async () => { state.fileReads++; return { mime: 'audio/wav', ext: 'wav' }; } } });
const { scopeSatisfies } = await import('./auth/scopes.js');
mock.module('./auth/authorization.js', { namedExports: { authorize: async context => {
    state.authorizations.push(context);
    return { allowed: context.tokenType === 'session' || scopeSatisfies(context.tokenScopes, context.requiredScope),
        status: 403, code: 'TOKEN_CEILING', message: 'denied' };
} } });
mock.module('./moderation/visibility.js', { namedExports: {
    assertCanWrite: async (actorId, category, action) => {
        state.guards.push({ actorId, category, action });
        if (state.readonly) throw Object.assign(new Error('readonly'), { status: 403, code: 'ACCOUNT_READ_ONLY' });
    },
    canViewContent: async () => state.visible,
    sanitizeProfile: async () => state.profileVisible ? { id: 3 } : null,
    visibleWhere: async () => ({ uploader_id: { notIn: [8] } }),
} });
mock.module('./prisma.js', { namedExports: { prisma: { ow_assets: {
    findUnique: async () => { state.assetReads++; return state.asset; },
    create: async ({ data }) => { state.created.push(data); return data; },
    findMany: async query => { state.listQueries.push(query); return [{ id: 7, uploader: { id: 3 } }]; },
    count: async query => { state.countQueries.push(query); return 1; },
} } } });
const { uploadFile, processSimpleImageUpload, createAssetRecord, getAssetsList } = await import('./assets.js');
const file = { buffer: Buffer.from('sample'), originalname: 'sample.wav', detectedMimeType: 'audio/wav', detectedExtension: 'wav' };
const res = (scopes = ['asset:create']) => ({ locals: { userid: 3, tokenType: 'oauth', scopes } });
beforeEach(() => Object.assign(state, { readonly: false, visible: true, profileVisible: true,
    imageReads: 0, fileReads: 0, s3Writes: 0, assetReads: 0, created: [], guards: [], authorizations: [],
    listQueries: [], countQueries: [], asset: { id: 7, uploader_id: 3, md5: 'test' } }));

test('readonly uploads fail before deduplication, file processing, or external writes', async () => {
    state.readonly = true;
    await assert.rejects(uploadFile(file, { purpose: 'scratch' }, res()), { code: 'ACCOUNT_READ_ONLY' });
    await assert.rejects(processSimpleImageUpload(file, {}, res()), { code: 'ACCOUNT_READ_ONLY' });
    assert.equal(state.assetReads + state.imageReads + state.fileReads + state.s3Writes + state.created.length, 0);
    assert.deepEqual(state.guards[0], { actorId: 3, category: 'assets', action: 'create' });
});

test('upload token ceilings apply even when an identical asset already exists', async () => {
    await assert.rejects(uploadFile(file, { purpose: 'scratch' }, res(['asset:read'])), { code: 'TOKEN_CEILING' });
    assert.equal(state.assetReads + state.s3Writes + state.created.length, 0);
});

test('a hidden duplicate cannot be reused or disclose its asset record', async () => {
    state.visible = false;
    await assert.rejects(uploadFile(file, { purpose: 'scratch' }, res()), { code: 'RESOURCE_NOT_FOUND' });
    assert.equal(state.assetReads, 1);
    assert.equal(state.s3Writes + state.created.length, 0);
});

test('valid upload deduplication remains available after caller policy checks', async () => {
    const result = await uploadFile(file, { purpose: 'scratch' }, res());
    assert.equal(result.isExisting, true);
    assert.equal(result.asset.id, 7);
    assert.equal(state.s3Writes + state.created.length, 0);
});

test('direct asset records recheck readonly before database creation', async () => {
    state.readonly = true;
    await assert.rejects(createAssetRecord({ uploaderId: 3 }), { code: 'ACCOUNT_READ_ONLY' });
    assert.deepEqual(state.created, []);
});

test('asset pagination filters before count and redacts a hidden uploader profile', async () => {
    state.profileVisible = false;
    const result = await getAssetsList({ viewerId: 9, page: 2, limit: 5 });
    assert.deepEqual(state.listQueries[0].where, state.countQueries[0].where);
    assert.deepEqual(state.listQueries[0].where.AND, [{ uploader_id: { notIn: [8] } }]);
    assert.equal(state.listQueries[0].skip, 5);
    assert.equal(result.assets[0].uploader, null);
});
