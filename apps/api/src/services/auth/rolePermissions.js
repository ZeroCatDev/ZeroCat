export const SYSTEM_ROLE_KEYS = {
    USER: "user",
    PROJECT: "project",
    ASSET: "asset",
    POST: "post",
    COMMENT: "comment",
    NOTIFICATION: "notification",
    LIST: "list",
    FOLLOW: "follow",
    BLOG: "blog",
    CACHEKV: "cachekv",
    OAUTH_APP: "oauth_app",
    TOKEN: "token",
    GIT_SYNC: "git_sync",
    ANALYTICS: "analytics",
    EVENT: "event",
    EXTENSION: "extension",
    ADMIN: "admin",
    // 项目协作角色：只在“合作者”等实例级特殊授予场景使用，不进默认角色。
    PROJECT_VIEWER: "project_viewer",
    PROJECT_EDITOR: "project_editor",
    PROJECT_MANAGER: "project_manager",
};

export const DEFAULT_USER_ROLE_KEYS = [
    SYSTEM_ROLE_KEYS.USER,
    SYSTEM_ROLE_KEYS.PROJECT,
    SYSTEM_ROLE_KEYS.ASSET,
    SYSTEM_ROLE_KEYS.POST,
    SYSTEM_ROLE_KEYS.COMMENT,
    SYSTEM_ROLE_KEYS.NOTIFICATION,
    SYSTEM_ROLE_KEYS.LIST,
    SYSTEM_ROLE_KEYS.FOLLOW,
    SYSTEM_ROLE_KEYS.BLOG,
    SYSTEM_ROLE_KEYS.CACHEKV,
    SYSTEM_ROLE_KEYS.OAUTH_APP,
    SYSTEM_ROLE_KEYS.TOKEN,
    SYSTEM_ROLE_KEYS.GIT_SYNC,
    SYSTEM_ROLE_KEYS.ANALYTICS,
    SYSTEM_ROLE_KEYS.EVENT,
    SYSTEM_ROLE_KEYS.EXTENSION,
];

export const SYSTEM_ROLES = [
    {
        key: SYSTEM_ROLE_KEYS.USER,
        name: "账户",
        description: "账户资料、密码和账号生命周期权限。",
        system: true,
        priority: 10,
    },
    {
        key: SYSTEM_ROLE_KEYS.PROJECT,
        name: "作品",
        description: "作品读取、创建、编辑、互动、删除和高风险设置权限。",
        system: true,
        priority: 20,
    },
    {
        key: SYSTEM_ROLE_KEYS.ASSET,
        name: "素材",
        description: "素材读取、上传和删除权限。",
        system: true,
        priority: 30,
    },
    {
        key: SYSTEM_ROLE_KEYS.POST,
        name: "帖子",
        description: "帖子读取、发布、同步、互动和删除权限。",
        system: true,
        priority: 40,
    },
    {
        key: SYSTEM_ROLE_KEYS.COMMENT,
        name: "评论",
        description: "评论读取、发表、修改、删除和评论空间管理权限。",
        system: true,
        priority: 50,
    },
    {
        key: SYSTEM_ROLE_KEYS.NOTIFICATION,
        name: "通知",
        description: "通知读取和状态更新权限。",
        system: true,
        priority: 60,
    },
    {
        key: SYSTEM_ROLE_KEYS.LIST,
        name: "作品列表",
        description: "作品列表读取、创建、修改和删除权限。",
        system: true,
        priority: 70,
    },
    {
        key: SYSTEM_ROLE_KEYS.FOLLOW,
        name: "关注关系",
        description: "关注关系读取、关注、取关、屏蔽和备注权限。",
        system: true,
        priority: 80,
    },
    {
        key: SYSTEM_ROLE_KEYS.BLOG,
        name: "博客",
        description: "博客草稿和文章读取、创建、修改和删除权限。",
        system: true,
        priority: 90,
    },
    {
        key: SYSTEM_ROLE_KEYS.CACHEKV,
        name: "键值存储",
        description: "账户键值存储读取、写入和删除权限。",
        system: true,
        priority: 100,
    },
    {
        key: SYSTEM_ROLE_KEYS.OAUTH_APP,
        name: "OAuth 应用",
        description: "OAuth 应用读取和管理权限。",
        system: true,
        priority: 110,
    },
    {
        key: SYSTEM_ROLE_KEYS.TOKEN,
        name: "令牌",
        description: "个人令牌读取和管理权限。",
        system: true,
        priority: 120,
    },
    {
        key: SYSTEM_ROLE_KEYS.GIT_SYNC,
        name: "Git 同步",
        description: "Git 同步读取、绑定、配置和触发权限。",
        system: true,
        priority: 130,
    },
    {
        key: SYSTEM_ROLE_KEYS.ANALYTICS,
        name: "数据分析",
        description: "统计分析数据读取权限。",
        system: true,
        priority: 140,
    },
    {
        key: SYSTEM_ROLE_KEYS.EVENT,
        name: "事件",
        description: "事件记录读取和写入权限。",
        system: true,
        priority: 150,
    },
    {
        key: SYSTEM_ROLE_KEYS.EXTENSION,
        name: "扩展",
        description: "扩展读取和管理权限。",
        system: true,
        priority: 160,
    },
    {
        key: SYSTEM_ROLE_KEYS.ADMIN,
        name: "管理页",
        description: "管理后台页面和管理 API 权限。",
        system: true,
        priority: 1000,
    },
    {
        key: SYSTEM_ROLE_KEYS.PROJECT_VIEWER,
        name: "项目查看者",
        description: "被授予后可查看指定私有项目，仅作为项目合作者实例级授予。",
        system: true,
        priority: 500,
    },
    {
        key: SYSTEM_ROLE_KEYS.PROJECT_EDITOR,
        name: "项目编辑者",
        description: "被授予后可查看并编辑指定项目（保存文件、提交、改资料、建分支），仅作为项目合作者实例级授予。",
        system: true,
        priority: 510,
    },
    {
        key: SYSTEM_ROLE_KEYS.PROJECT_MANAGER,
        name: "项目管理员",
        description: "项目编辑者权限外，还可更改可见性、邀请/移除其他合作者；不能删除项目。仅作为项目合作者实例级授予。",
        system: true,
        priority: 520,
    },
];

export const SYSTEM_ROLE_PERMISSIONS = {
    [SYSTEM_ROLE_KEYS.USER]: [
        "user:read",
        "user:update",
        "user:delete",
    ],
    [SYSTEM_ROLE_KEYS.PROJECT]: [
        "project:read",
        "project:create",
        "project:update",
        "project:interact",
        "project:delete",
        "project:manage",
    ],
    [SYSTEM_ROLE_KEYS.ASSET]: [
        "asset:read",
        "asset:create",
        "asset:delete",
    ],
    [SYSTEM_ROLE_KEYS.POST]: [
        "post:read",
        "post:create",
        "post:update",
        "post:interact",
        "post:delete",
    ],
    [SYSTEM_ROLE_KEYS.COMMENT]: [
        "comment:read",
        "comment:create",
        "comment:update",
        "comment:delete",
        "comment:manage",
    ],
    [SYSTEM_ROLE_KEYS.NOTIFICATION]: [
        "notification:read",
        "notification:update",
    ],
    [SYSTEM_ROLE_KEYS.LIST]: [
        "list:read",
        "list:create",
        "list:update",
        "list:delete",
    ],
    [SYSTEM_ROLE_KEYS.FOLLOW]: [
        "follow:read",
        "follow:interact",
    ],
    [SYSTEM_ROLE_KEYS.BLOG]: [
        "blog:read",
        "blog:create",
        "blog:update",
        "blog:delete",
    ],
    [SYSTEM_ROLE_KEYS.CACHEKV]: [
        "cachekv:read",
        "cachekv:update",
        "cachekv:delete",
    ],
    [SYSTEM_ROLE_KEYS.OAUTH_APP]: [
        "oauth_app:read",
        "oauth_app:manage",
    ],
    [SYSTEM_ROLE_KEYS.TOKEN]: [
        "token:read",
        "token:manage",
    ],
    [SYSTEM_ROLE_KEYS.GIT_SYNC]: [
        "git_sync:read",
        "git_sync:manage",
    ],
    [SYSTEM_ROLE_KEYS.ANALYTICS]: [
        "analytics:read",
    ],
    [SYSTEM_ROLE_KEYS.EVENT]: [
        "event:read",
        "event:create",
    ],
    [SYSTEM_ROLE_KEYS.EXTENSION]: [
        "extension:read",
        "extension:manage",
    ],
    [SYSTEM_ROLE_KEYS.ADMIN]: [
        "admin:manage",
    ],
    [SYSTEM_ROLE_KEYS.PROJECT_VIEWER]: [
        "project:read",
    ],
    [SYSTEM_ROLE_KEYS.PROJECT_EDITOR]: [
        "project:read",
        "project:create",
        "project:update",
        "project:interact",
    ],
    [SYSTEM_ROLE_KEYS.PROJECT_MANAGER]: [
        "project:read",
        "project:create",
        "project:update",
        "project:interact",
        "project:manage",
    ],
};

// 项目协作角色，从低到高排列。用于邀请合作者时校验 role_key 以及前端展示。
export const COLLABORATION_ROLE_KEYS = [
    SYSTEM_ROLE_KEYS.PROJECT_VIEWER,
    SYSTEM_ROLE_KEYS.PROJECT_EDITOR,
    SYSTEM_ROLE_KEYS.PROJECT_MANAGER,
];

export const DEFAULT_USER_PERMISSIONS = [
    ...new Set(DEFAULT_USER_ROLE_KEYS.flatMap((roleKey) => SYSTEM_ROLE_PERMISSIONS[roleKey] || [])),
];

export function assertExplicitRolePermissions(roleKey, permissions) {
    const wildcardPermission = permissions.find((permission) =>
        permission === "*" || String(permission).includes(":*")
    );
    if (wildcardPermission) {
        throw new Error(`角色 ${roleKey} 使用了通配权限: ${wildcardPermission}`);
    }

    const duplicatePermission = permissions.find((permission, index) =>
        permissions.indexOf(permission) !== index
    );
    if (duplicatePermission) {
        throw new Error(`角色 ${roleKey} 重复声明权限: ${duplicatePermission}`);
    }
}

export function assertSystemRoleDefinitions() {
    const roleKeys = new Set(SYSTEM_ROLES.map((role) => role.key));
    for (const roleKey of Object.values(SYSTEM_ROLE_KEYS)) {
        if (!roleKeys.has(roleKey)) {
            throw new Error(`缺少系统角色定义: ${roleKey}`);
        }
        const permissions = SYSTEM_ROLE_PERMISSIONS[roleKey];
        if (!Array.isArray(permissions)) {
            throw new Error(`缺少系统角色权限: ${roleKey}`);
        }
        assertExplicitRolePermissions(roleKey, permissions);
    }
}

export default {
    SYSTEM_ROLE_KEYS,
    DEFAULT_USER_ROLE_KEYS,
    SYSTEM_ROLES,
    SYSTEM_ROLE_PERMISSIONS,
    DEFAULT_USER_PERMISSIONS,
    COLLABORATION_ROLE_KEYS,
    assertExplicitRolePermissions,
    assertSystemRoleDefinitions,
};
