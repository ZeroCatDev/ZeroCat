import {WebSocketServer, WebSocket} from "ws";
import logger from "./logger.js";
import {prisma} from "./prisma.js";
import redisClient from "./redis.js";
import {verifyToken} from "./auth/tokenUtils.js";
import {verifyAccountToken} from "./auth/accountTokenService.js";

const CLOUD_EVENT_TARGET_TYPE = "scratch_cloud";
const TARGET_CONFIG_TYPE_PROJECT = "project";
const TARGET_CONFIG_KEY_CLOUD_ANON_WRITE = "scratch.clouddata.anonymouswrite";
const CLOUD_PREFIXES = ["☁ ", ":cloud: "];
const CLOUD_MAX_NAME_LENGTH = 1024;
const CLOUD_MAX_VALUE_LENGTH = 100000;
const CLOUD_MAX_ROOM_CLIENTS = 128;

const WS_CLOSE_ERROR = 4000;
const WS_CLOSE_OVERLOADED = 4003;
const WS_CLOSE_PROJECT_UNAVAILABLE = 4004;

const rooms = new Map();

const cloudVarsRedisKey = (projectId) => `scratch:cloud:${projectId}:vars`;
const cloudSnapshotDbKey = (projectId) => `scratch:cloud:${projectId}:vars`;

class CloudWsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const isValidCloudName = (name) => {
    if (typeof name !== "string") return false;
    if (name.length > CLOUD_MAX_NAME_LENGTH) return false;
    for (const prefix of CLOUD_PREFIXES) {
        if (name === prefix) return false;
        if (name.startsWith(prefix)) return true;
    }
    return false;
};

const normalizeCloudValue = (value) => {
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        if (value.toString().length > CLOUD_MAX_VALUE_LENGTH) return null;
        return value.toString();
    }
    if (typeof value === "string") {
        if (value.length > CLOUD_MAX_VALUE_LENGTH) return null;
        if (value === "." || value === "-") return null;

        let seenDecimal = false;
        let i = 0;
        if (value.charCodeAt(0) === 45) i++;
        for (; i < value.length; i++) {
            const code = value.charCodeAt(i);
            if (code === 46) {
                if (seenDecimal) return null;
                seenDecimal = true;
                continue;
            }
            if (code < 48 || code > 57) {
                return null;
            }
        }
        return value;
    }
    return null;
};

const parseBooleanInput = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
    return null;
};

const sanitizeAnonymousInputName = (name) => {
    const raw = String(name || "").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
    const cleaned = raw.replace(/[\[\]]/g, "");
    return cleaned.slice(0, 64) || "unknown";
};

const normalizeIp = (ipAddress) => {
    const value = String(ipAddress || "").trim();
    if (!value) return "unknown";
    if (value.startsWith("::ffff:")) return value.slice(7);
    return value;
};

const createSetMessage = (name, value) =>
    JSON.stringify({
        method: "set",
        name,
        value,
    });

const parseCookieToken = (cookieHeader) => {
    if (!cookieHeader || typeof cookieHeader !== "string") {
        return null;
    }
    const cookies = cookieHeader.split(";");
    for (const pair of cookies) {
        const [rawKey, ...rest] = pair.trim().split("=");
        if (rawKey === "token") {
            return decodeURIComponent(rest.join("="));
        }
    }
    return null;
};

const extractTokenFromUpgradeRequest = (req) => {
    const authHeader = req.headers["authorization"];
    if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            return parts[1];
        }
        return authHeader;
    }

    try {
        const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
        if (url.searchParams.get("token")) {
            return url.searchParams.get("token");
        }
    } catch (error) {
        logger.debug("[scratch-cloud-ws] 解析URL失败:", error);
    }

    return parseCookieToken(req.headers.cookie);
};

const extractClientIpFromUpgradeRequest = (req) => {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
        const first = forwardedFor.split(",")[0].trim();
        return normalizeIp(first);
    }
    return normalizeIp(req.socket?.remoteAddress || "");
};

const getProjectAnonymousWriteEnabled = async (projectId) => {
    const record = await prisma.ow_target_configs.findUnique({
        where: {
            target_type_target_id_key: {
                target_type: TARGET_CONFIG_TYPE_PROJECT,
                target_id: String(projectId),
                key: TARGET_CONFIG_KEY_CLOUD_ANON_WRITE,
            },
        },
        select: {value: true},
    });
    const parsed = parseBooleanInput(record?.value);
    return parsed === null ? false : parsed;
};

const appendCloudHistory = async ({
    projectId,
    method,
    name,
    value = null,
    actorId = null,
    actorName = null,
    ip = "",
}) => {
    return prisma.project_clouddata_history.create({
        data: {
            project_id: Number(projectId),
            method: String(method || ""),
            name: String(name || ""),
            value: value === null ? null : String(value),
            actor_id: typeof actorId === "number" ? actorId : null,
            actor_name: actorName ? String(actorName) : null,
            ip: ip ? String(ip) : "",
        },
        select: {id: true},
    });
};

const writeAndDestroy = (socket, statusCode, message) => {
    socket.write(
        `HTTP/1.1 ${statusCode}\r\n` +
        "Content-Type: text/plain; charset=utf-8\r\n" +
        "Connection: close\r\n" +
        "\r\n" +
        `${message}`
    );
    socket.destroy();
};

const authenticateRequest = async (req) => {
    const token = extractTokenFromUpgradeRequest(req);
    const clientIp = extractClientIpFromUpgradeRequest(req);
    if (!token) {
        return {
            ok: true,
            hasToken: false,
            user: null,
        };
    }

    const accountTokenResult = await verifyAccountToken(token);
    if (accountTokenResult.valid && accountTokenResult.user) {
        return {
            ok: true,
            hasToken: true,
            user: {
                userid: accountTokenResult.user.userid,
                username: accountTokenResult.user.username,
            },
        };
    }

    const jwtResult = await verifyToken(token, clientIp);
    if (!jwtResult.valid || !jwtResult.user) {
        return {ok: false, message: jwtResult.message || "登录失效"};
    }

    return {
        ok: true,
        hasToken: true,
        user: {
            userid: jwtResult.user.userid,
            username: jwtResult.user.username,
        },
    };
};

const getScratchProject = async (projectId) => {
    const project = await prisma.ow_projects.findFirst({
        where: {id: Number(projectId)},
        select: {
            id: true,
            authorid: true,
            state: true,
            type: true,
        },
    });

    if (!project) {
        return null;
    }
    if (project.type !== "scratch") {
        return null;
    }
    return project;
};

const loadCloudState = async (project) => {
    const varsKey = cloudVarsRedisKey(project.id);
    let vars = {};

    if (redisClient.client && redisClient.isConnected) {
        vars = await redisClient.client.hgetall(varsKey);
        if (Object.keys(vars).length > 0) {
            return vars;
        }
    }

    if (!project.authorid) {
        return {};
    }

    const snapshot = await prisma.ow_cache_kv.findUnique({
        where: {
            user_id_key: {
                user_id: project.authorid,
                key: cloudSnapshotDbKey(project.id),
            },
        },
        select: {value: true},
    });

    if (!snapshot || typeof snapshot.value !== "object" || Array.isArray(snapshot.value)) {
        return {};
    }

    vars = snapshot.value;
    if (redisClient.client && redisClient.isConnected && Object.keys(vars).length > 0) {
        await redisClient.client.hset(varsKey, vars);
    }
    return vars;
};

const saveCloudSnapshot = async (project, vars, creatorIp) => {
    if (!project.authorid) return;

    await prisma.ow_cache_kv.upsert({
        where: {
            user_id_key: {
                user_id: project.authorid,
                key: cloudSnapshotDbKey(project.id),
            },
        },
        create: {
            user_id: project.authorid,
            key: cloudSnapshotDbKey(project.id),
            value: vars,
            creator_ip: creatorIp || "",
        },
        update: {
            value: vars,
            creator_ip: creatorIp || "",
        },
    });
};

const appendCloudEvent = async (projectId, actorId, eventData) =>
    prisma.ow_events.create({
        data: {
            event_type: "cloud_variable",
            actor_id: actorId,
            target_type: CLOUD_EVENT_TARGET_TYPE,
            target_id: Number(projectId),
            event_data: eventData,
            public: false,
        },
        select: {id: true, created_at: true},
    });

const ensureRoom = (projectId) => {
    if (!rooms.has(projectId)) {
        rooms.set(projectId, new Set());
    }
    return rooms.get(projectId);
};

const leaveRoom = (ws) => {
    if (!ws.projectId || !rooms.has(ws.projectId)) {
        return;
    }
    const room = rooms.get(ws.projectId);
    room.delete(ws);
    if (room.size === 0) {
        rooms.delete(ws.projectId);
    }
};

const broadcastToOtherClients = (projectId, sourceWs, message) => {
    const room = rooms.get(projectId);
    if (!room) {
        return;
    }
    for (const client of room) {
        if (client !== sourceWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
};

const processCloudWrite = async (project, ws, message) => {
    const method = message.method;
    const vars = await loadCloudState(project);
    const username = ws.user.username;
    const actorId = typeof ws.user.userid === "number" ? ws.user.userid : null;
    const actorName = ws.user.username || (actorId === null ? `[匿名]unknown` : String(actorId));

    if (method === "set" || method === "create") {
        const name = message.name;
        const value = normalizeCloudValue(message.value);

        if (!isValidCloudName(name)) {
            throw new CloudWsError(WS_CLOSE_ERROR, "invalid variable name");
        }
        if (value === null) {
            // Protocol: invalid value should be ignored.
            return null;
        }

        vars[name] = value;
        if (redisClient.client && redisClient.isConnected) {
            await redisClient.client.hset(cloudVarsRedisKey(project.id), name, value);
        }
        await saveCloudSnapshot(project, vars, ws.ip);
        const event = await appendCloudEvent(project.id, actorId, {
            method: "set",
            name,
            value,
            user: username,
        });
        await appendCloudHistory({
            projectId: project.id,
            method: "set",
            name,
            value,
            actorId,
            actorName,
            ip: ws.ip,
        });

        return {
            id: event.id,
            method: "set",
            name,
            value,
            user: username,
            created_at: event.created_at,
            broadcast: createSetMessage(name, value),
        };
    }

    if (method === "rename") {
        const oldName = message.name;
        const newName = message.new_name;
        if (!isValidCloudName(oldName) || !isValidCloudName(newName)) {
            throw new CloudWsError(WS_CLOSE_ERROR, "invalid variable name");
        }
        if (!(oldName in vars)) {
            throw new CloudWsError(WS_CLOSE_ERROR, "variable does not exist");
        }

        vars[newName] = vars[oldName];
        delete vars[oldName];
        if (redisClient.client && redisClient.isConnected) {
            const redisKey = cloudVarsRedisKey(project.id);
            await redisClient.client.multi().hdel(redisKey, oldName).hset(redisKey, newName, vars[newName]).exec();
        }
        await saveCloudSnapshot(project, vars, ws.ip);
        const event = await appendCloudEvent(project.id, actorId, {
            method: "rename",
            name: oldName,
            new_name: newName,
            value: vars[newName],
            user: username,
        });
        await appendCloudHistory({
            projectId: project.id,
            method: "rename",
            name: oldName,
            value: vars[newName],
            actorId,
            actorName,
            ip: ws.ip,
        });

        return {
            id: event.id,
            method: "rename",
            name: oldName,
            new_name: newName,
            value: vars[newName],
            user: username,
            created_at: event.created_at,
            broadcast: createSetMessage(newName, vars[newName]),
        };
    }

    if (method === "delete") {
        const name = message.name;
        if (!isValidCloudName(name) || !(name in vars)) {
            throw new CloudWsError(WS_CLOSE_ERROR, "variable does not exist");
        }

        delete vars[name];
        if (redisClient.client && redisClient.isConnected) {
            await redisClient.client.hdel(cloudVarsRedisKey(project.id), name);
        }
        await saveCloudSnapshot(project, vars, ws.ip);
        const event = await appendCloudEvent(project.id, actorId, {
            method: "delete",
            name,
            user: username,
        });
        await appendCloudHistory({
            projectId: project.id,
            method: "delete",
            name,
            actorId,
            actorName,
            ip: ws.ip,
        });

        return {
            id: event.id,
            method: "delete",
            name,
            user: username,
            created_at: event.created_at,
            broadcast: null,
        };
    }

    throw new CloudWsError(WS_CLOSE_ERROR, `unknown method: ${method}`);
};

const handleHandshake = async (ws, message) => {
    if (typeof message.project_id === "undefined") {
        throw new CloudWsError(WS_CLOSE_ERROR, "handshake missing project_id");
    }

    const roomId = `${message.project_id}`;
    if (!roomId || roomId.length >= 1000) {
        throw new CloudWsError(WS_CLOSE_ERROR, "invalid room id");
    }

    const projectId = Number(roomId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new CloudWsError(WS_CLOSE_ERROR, "invalid project_id");
    }

    const project = await getScratchProject(projectId);
    if (!project) {
        throw new CloudWsError(WS_CLOSE_PROJECT_UNAVAILABLE, "project unavailable");
    }

    const userProvidedName = typeof message.user === "string" ? message.user : "";

    if (ws.authUser && typeof ws.authUser.userid === "number") {
        if (project.state !== "public" && project.authorid !== ws.authUser.userid) {
            throw new CloudWsError(WS_CLOSE_PROJECT_UNAVAILABLE, "project unavailable");
        }
        ws.user = {
            userid: ws.authUser.userid,
            username: ws.authUser.username || String(ws.authUser.userid),
        };
    } else {
        if (project.state !== "public") {
            throw new CloudWsError(WS_CLOSE_PROJECT_UNAVAILABLE, "project unavailable");
        }
        const anonymousWriteEnabled = await getProjectAnonymousWriteEnabled(project.id);
        if (!anonymousWriteEnabled) {
            throw new CloudWsError(WS_CLOSE_PROJECT_UNAVAILABLE, "anonymous disabled");
        }
        const resolvedInputName = sanitizeAnonymousInputName(userProvidedName);
        ws.user = {
            userid: null,
            username: `[匿名]${resolvedInputName}`,
        };
    }

    ws.project = project;
    ws.projectId = project.id;
    const room = ensureRoom(project.id);
    if (room.size >= CLOUD_MAX_ROOM_CLIENTS) {
        throw new CloudWsError(WS_CLOSE_OVERLOADED, "room is full");
    }
    room.add(ws);

    const vars = await loadCloudState(project);
    const messages = Object.entries(vars).map(([name, value]) => createSetMessage(name, value));
    if (messages.length > 0) {
        ws.send(messages.join("\n"));
    }
};

const processRawMessage = async (ws, rawText) => {
    const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
        let message;
        try {
            message = JSON.parse(line);
        } catch (error) {
            throw new CloudWsError(WS_CLOSE_ERROR, "invalid json");
        }
        if (!message || typeof message !== "object" || typeof message.method !== "string") {
            throw new CloudWsError(WS_CLOSE_ERROR, "invalid message");
        }

        if (message.method === "handshake") {
            if (ws.project) {
                throw new CloudWsError(WS_CLOSE_ERROR, "already handshaked");
            }
            await handleHandshake(ws, message);
            continue;
        }

        if (!ws.project) {
            throw new CloudWsError(WS_CLOSE_ERROR, "handshake required");
        }

        const update = await processCloudWrite(ws.project, ws, message);
        if (update?.broadcast) {
            broadcastToOtherClients(ws.project.id, ws, update.broadcast);
        }
    }
};

export function attachScratchCloudWebSocket(server) {
    const wss = new WebSocketServer({
        noServer: true,
        clientTracking: true,
        maxPayload: 1024 * 1024,
    });

    server.on("upgrade", async (req, socket, head) => {
        let pathname = "/";
        try {
            const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
            pathname = url.pathname;
        } catch (error) {
            writeAndDestroy(socket, "400 Bad Request", "Bad Request");
            return;
        }

        if (pathname !== "/scratch/cloud/ws") {
            return;
        }

        try {
            const authResult = await authenticateRequest(req);
            if (!authResult.ok) {
                writeAndDestroy(socket, "401 Unauthorized", authResult.message || "Unauthorized");
                return;
            }

            req.wsUser = authResult.user;
            req.wsHasToken = Boolean(authResult.hasToken);
            req.wsClientIp = extractClientIpFromUpgradeRequest(req);
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req);
            });
        } catch (error) {
            logger.error("[scratch-cloud-ws] 握手前认证失败:", error);
            writeAndDestroy(socket, "500 Internal Server Error", "Internal Server Error");
        }
    });

    wss.on("connection", (ws, req) => {
        ws.authUser = req.wsUser || null;
        ws.hasToken = Boolean(req.wsHasToken);
        ws.user = null;
        ws.project = null;
        ws.projectId = null;
        ws.ip = req.wsClientIp || extractClientIpFromUpgradeRequest(req);

        ws.on("message", async (data, isBinary) => {
            if (isBinary) {
                ws.close(WS_CLOSE_ERROR, "binary not allowed");
                return;
            }
            try {
                await processRawMessage(ws, data.toString());
            } catch (error) {
                logger.debug("[scratch-cloud-ws] 消息处理失败:", error);
                const closeCode = error instanceof CloudWsError ? error.code : WS_CLOSE_ERROR;
                ws.close(closeCode, "protocol error");
            }
        });

        ws.on("close", () => {
            leaveRoom(ws);
        });

        ws.on("error", (error) => {
            logger.error("[scratch-cloud-ws] 连接异常:", error);
            leaveRoom(ws);
        });
    });

    logger.info("[scratch-cloud-ws] WebSocket端点已启用: /scratch/cloud/ws");
    return wss;
}
