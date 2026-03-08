/**
 * Embedding 向量生成服务
 *
 * 提供文本 → 向量转换能力，支持 OpenAI 兼容 API（包括 Ollama / vLLM / LiteLLM 等）。
 * 向量存储使用 PostgreSQL + pgvector 扩展，独立表 ow_embeddings。
 * 与 Gorse 推荐系统集成：生成向量后同步写入 Item.Labels.embedding。
 */
import OpenAI from 'openai';
import zcconfig from './config/zcconfig.js';
import logger from './logger.js';
import { prisma } from './prisma.js';

// ======================== 配置读取 ========================

/**
 * 获取 embedding 配置项（带缓存友好的批量读取）
 */
async function getEmbeddingConfig() {
    const [enabled, provider, apiBase, apiKey, model, dimensions, batchSize, maxTokens, timeout] =
        await Promise.all([
            zcconfig.get('embedding.enabled'),
            zcconfig.get('embedding.provider'),
            zcconfig.get('embedding.api_base'),
            zcconfig.get('embedding.api_key'),
            zcconfig.get('embedding.model'),
            zcconfig.get('embedding.dimensions'),
            zcconfig.get('embedding.batch_size'),
            zcconfig.get('embedding.max_tokens'),
            zcconfig.get('embedding.request_timeout'),
        ]);

    return {
        enabled: enabled === true,
        provider: provider || 'openai',
        apiBase: (apiBase || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        apiKey: apiKey || '',
        model: model || 'text-embedding-3-small',
        dimensions: Number(dimensions) || 1536,
        batchSize: Number(batchSize) || 20,
        maxTokens: Number(maxTokens) || 8000,
        timeout: Number(timeout) || 30000,
    };
}

// ======================== 向量生成 ========================

/** 缓存的 OpenAI 客户端实例（配置变更时重建） */
let _openaiClient = null;
let _openaiClientKey = '';

/**
 * 获取（或重建）OpenAI 客户端
 */
async function getOpenAIClient() {
    const config = await getEmbeddingConfig();
    logger.debug(config)
    // 用 apiBase + apiKey 组合作为缓存 key，配置变更时重建客户端
    const cacheKey = `${config.apiBase}|${config.apiKey}|${config.timeout}`;
    if (_openaiClient && _openaiClientKey === cacheKey) {
        return { client: _openaiClient, config };
    }

    _openaiClient = new OpenAI({
        apiKey: config.apiKey || 'sk-placeholder', // SDK 要求非空，Ollama 等无需真实 key
        baseURL: config.apiBase,
        timeout: config.timeout,
        maxRetries: 0, // 重试由 BullMQ 负责
    });
    _openaiClientKey = cacheKey;
    return { client: _openaiClient, config };
}

/**
 * 调用 OpenAI 兼容 API 生成 embedding
 * @param {string|string[]} input - 单条或批量文本
 * @returns {Promise<number[][]>} 向量数组
 */
export async function generateEmbeddings(input) {
    const { client, config } = await getOpenAIClient();

    if (!config.enabled) {
        throw new Error('Embedding 服务未启用，请先在配置中设置 embedding.enabled = true');
    }

    const texts = Array.isArray(input) ? input : [input];
    if (texts.length === 0) return [];

    // 截断超长文本（粗略按字符估算 token）
    const maxChars = config.maxTokens * 3; // 粗略 1 token ≈ 3 chars（中英混合）
    const truncated = texts.map(t => {
        if (!t) return '';
        return t.length > maxChars ? t.substring(0, maxChars) : t;
    });

    const params = {
        input: truncated,
        model: config.model,
    };
    // text-embedding-3-* 系列支持指定维度；其他模型忽略
    if (config.dimensions) {
        params.dimensions = config.dimensions;
    }

    try {
        const resp = await client.embeddings.create(params);

        // OpenAI 返回的 data 可能乱序，按 index 排序后再取 embedding
        const sorted = resp.data.sort((a, b) => a.index - b.index);
        return sorted.map(d => d.embedding);
    } catch (error) {
        if (error instanceof OpenAI.APIError) {
            throw new Error(`Embedding API 错误 (${error.status}): ${error.message}`);
        }
        throw error;
    }
}

/**
 * 生成单条文本的 embedding
 */
export async function generateEmbedding(text) {
    const results = await generateEmbeddings([text]);
    return results[0] || null;
}

// ======================== pgvector 存储 ========================

/**
 * 确保 pgvector 扩展和表已就绪（幂等）
 * 表结构由 Prisma migration 管理（20260308090000_add_pgvector_embeddings），
 * 此函数作为运行时安全检查，兼容未执行迁移的环境。
 */
let _pgvectorReady = false;

export async function ensurePgvector() {
    if (_pgvectorReady) return;

    try {
        // 扩展必须存在（migration 会创建，这里兜底）
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

        // 检查表是否存在（由 migration 创建）；若未迁移则自动补建
        const tableCheck = await prisma.$queryRawUnsafe(`
            SELECT to_regclass('public.ow_embeddings')::text AS tbl
        `);
        if (!tableCheck[0]?.tbl) {
            const dimensions = (await zcconfig.get('embedding.dimensions')) || 1536;

            logger.warn('[embedding] ow_embeddings 表不存在，自动创建（建议执行 prisma migrate deploy）');
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS ow_embeddings (
                    id              SERIAL PRIMARY KEY,
                    entity_type     VARCHAR(32) NOT NULL,
                    entity_id       INT NOT NULL,
                    embedding       vector(${dimensions}),
                    text_hash       VARCHAR(64),
                    model           VARCHAR(128),
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(entity_type, entity_id)
                )
            `);

            await prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_ow_embeddings_vector
                ON ow_embeddings USING hnsw (embedding vector_cosine_ops)
            `);

            await prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_ow_embeddings_entity
                ON ow_embeddings (entity_type, entity_id)
            `);
        }

        _pgvectorReady = true;
        logger.info('[embedding] pgvector 扩展和表已就绪');
    } catch (error) {
        logger.error('[embedding] 初始化 pgvector 失败:', error.message);
        throw error;
    }
}

/**
 * 存储 embedding 向量到 PostgreSQL
 * @param {string} entityType - 'post' | 'user'
 * @param {number} entityId
 * @param {number[]} vector
 * @param {string} [textHash] - 文本哈希，用于判断是否需要重新生成
 * @param {string} [model] - 模型名，用于追踪
 */
export async function saveEmbedding(entityType, entityId, vector, textHash = null, model = null) {
    await ensurePgvector();

    const vectorStr = `[${vector.join(',')}]`;

    await prisma.$executeRawUnsafe(`
        INSERT INTO ow_embeddings (entity_type, entity_id, embedding, text_hash, model, updated_at)
        VALUES ($1, $2, $3::vector, $4, $5, NOW())
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET embedding = EXCLUDED.embedding,
                      text_hash = EXCLUDED.text_hash,
                      model = EXCLUDED.model,
                      updated_at = NOW()
    `, entityType, entityId, vectorStr, textHash, model);

    logger.debug(`[embedding] saveEmbedding(${entityType}, ${entityId}) dim=${vector.length} hash=${textHash}`);
}

/**
 * 批量存储 embedding
 */
export async function saveEmbeddings(items) {
    await ensurePgvector();

    for (const item of items) {
        await saveEmbedding(item.entityType, item.entityId, item.vector, item.textHash, item.model);
    }
}

/**
 * 获取指定实体的 embedding
 * @returns {Promise<number[]|null>}
 */
export async function getEmbedding(entityType, entityId) {
    await ensurePgvector();

    const rows = await prisma.$queryRawUnsafe(`
        SELECT embedding::text as embedding FROM ow_embeddings
        WHERE entity_type = $1 AND entity_id = $2
    `, entityType, Number(entityId));

    logger.debug(`[embedding] getEmbedding(${entityType}, ${entityId}) => rows=${rows?.length}, has_data=${!!rows?.[0]?.embedding}`);

    if (!rows || rows.length === 0) return null;

    // pgvector 返回格式 "[0.1,0.2,...]"
    const raw = rows[0].embedding;
    if (!raw) return null;
    return JSON.parse(raw);
}

/**
 * 批量获取指定实体的 embedding
 * @returns {Promise<Map<number, number[]>>}
 */
export async function getEmbeddings(entityType, entityIds) {
    if (!entityIds || entityIds.length === 0) return new Map();
    await ensurePgvector();

    const numericIds = entityIds.map(Number);
    // 用 IN + 展开占位符，避免 $queryRawUnsafe 无法序列化 JS 数组的问题
    const placeholders = numericIds.map((_, i) => `$${i + 2}`).join(',');
    const rows = await prisma.$queryRawUnsafe(
        `SELECT entity_id, embedding::text as embedding FROM ow_embeddings
         WHERE entity_type = $1 AND entity_id IN (${placeholders})`,
        entityType,
        ...numericIds
    );

    logger.debug(`[embedding] getEmbeddings(${entityType}, count=${entityIds.length}) => found=${rows?.length}`);

    const map = new Map();
    for (const row of rows) {
        if (row.embedding) {
            map.set(Number(row.entity_id), JSON.parse(row.embedding));
        }
    }
    return map;
}

/**
 * 获取指定实体的 text_hash（用于判断是否需要重新生成）
 */
export async function getTextHash(entityType, entityId) {
    const rows = await prisma.$queryRawUnsafe(`
        SELECT text_hash FROM ow_embeddings
        WHERE entity_type = $1 AND entity_id = $2
    `, entityType, entityId);

    return rows?.[0]?.text_hash || null;
}

/**
 * 批量获取 text_hash
 * @returns {Promise<Map<number, string>>}
 */
export async function getTextHashes(entityType, entityIds) {
    if (!entityIds || entityIds.length === 0) return new Map();

    const numericIds = entityIds.map(Number);
    const placeholders = numericIds.map((_, i) => `$${i + 2}`).join(',');
    const rows = await prisma.$queryRawUnsafe(
        `SELECT entity_id, text_hash FROM ow_embeddings
         WHERE entity_type = $1 AND entity_id IN (${placeholders})`,
        entityType,
        ...numericIds
    );

    const map = new Map();
    for (const row of rows) {
        if (row.text_hash) {
            map.set(Number(row.entity_id), row.text_hash);
        }
    }
    return map;
}

/**
 * 删除指定实体的 embedding
 */
export async function deleteEmbedding(entityType, entityId) {
    await prisma.$executeRawUnsafe(`
        DELETE FROM ow_embeddings WHERE entity_type = $1 AND entity_id = $2
    `, entityType, entityId);
}

// ======================== 文本构建 ========================

/**
 * 将帖子构建为用于 embedding 的文本
 */
export function buildPostText(post) {
    const parts = [];

    if (post.content) {
        parts.push(post.content);
    }

    if (post.embed && typeof post.embed === 'object') {
        if (post.embed.type) parts.push(`[${post.embed.type}]`);
        if (post.embed.title) parts.push(post.embed.title);
        if (post.embed.description) parts.push(post.embed.description);
    }

    return parts.join(' ').trim();
}

/**
 * 将用户基础信息构建为用于 embedding 的文本
 */
export function buildUserProfileText(user) {
    const parts = [];
    if (user.display_name) parts.push(user.display_name);
    if (user.username) parts.push(`@${user.username}`);
    if (user.bio) parts.push(user.bio);
    if (user.motto) parts.push(user.motto);
    return parts.join(' ').trim();
}

// ======================== 相似度搜索 ========================

/**
 * 基于向量搜索相似实体
 * @param {string} entityType
 * @param {number[]} queryVector
 * @param {number} limit
 * @param {number[]} [excludeIds]
 * @returns {Promise<{entityId: number, similarity: number}[]>}
 */
export async function searchSimilar(entityType, queryVector, limit = 20, excludeIds = []) {
    await ensurePgvector();

    const vectorStr = `[${queryVector.join(',')}]`;

    let query = `
        SELECT entity_id, 1 - (embedding <=> $1::vector) as similarity
        FROM ow_embeddings
        WHERE entity_type = $2
    `;
    const params = [vectorStr, entityType];

    if (excludeIds.length > 0) {
        query += ` AND entity_id != ALL($3::int[])`;
        params.push(excludeIds);
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT ${Math.min(limit, 100)}`;

    const rows = await prisma.$queryRawUnsafe(query, ...params);
    return rows.map(r => ({ entityId: r.entity_id, similarity: Number(r.similarity) }));
}

// ======================== 工具函数 ========================

/**
 * 简易文本哈希（用于 change detection）
 */
export function hashText(text) {
    if (!text) return '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString(36);
}

/**
 * 向量归一化
 */
export function normalizeVector(vec) {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

/**
 * 时间衰减加权合并多个向量
 * @param {Array<{vector: number[], weight: number, timestamp: Date}>} entries
 * @returns {number[]} 归一化后的加权平均向量
 */
export function timeWeightedMerge(entries) {
    if (!entries || entries.length === 0) return null;

    const now = Date.now();
    const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 天半衰期

    const dim = entries[0].vector.length;
    const result = new Array(dim).fill(0);
    let totalWeight = 0;

    for (const entry of entries) {
        if (!entry.vector || entry.vector.length !== dim) continue;

        const ageMs = now - new Date(entry.timestamp).getTime();
        const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
        const w = (entry.weight || 1) * decay;

        for (let i = 0; i < dim; i++) {
            result[i] += entry.vector[i] * w;
        }
        totalWeight += w;
    }

    if (totalWeight === 0) return null;

    for (let i = 0; i < dim; i++) {
        result[i] /= totalWeight;
    }

    return normalizeVector(result);
}

/**
 * 获取 embedding 服务状态
 */
export async function getEmbeddingStatus() {
    const config = await getEmbeddingConfig();

    const result = {
        enabled: config.enabled,
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
        apiBase: config.apiBase,
    };

    if (config.enabled) {
        try {
            const countResult = await prisma.$queryRawUnsafe(`
                SELECT entity_type, COUNT(*)::int as cnt
                FROM ow_embeddings
                GROUP BY entity_type
            `);
            result.storedEmbeddings = {};
            for (const row of countResult) {
                result.storedEmbeddings[row.entity_type] = row.cnt;
            }
        } catch (e) {
            result.storedEmbeddings = null;
            result.pgvectorReady = false;
        }
    }

    return result;
}

export default {
    generateEmbedding,
    generateEmbeddings,
    ensurePgvector,
    saveEmbedding,
    saveEmbeddings,
    getEmbedding,
    getEmbeddings,
    getTextHash,
    getTextHashes,
    deleteEmbedding,
    buildPostText,
    buildUserProfileText,
    searchSimilar,
    hashText,
    normalizeVector,
    timeWeightedMerge,
    getEmbeddingStatus,
};
