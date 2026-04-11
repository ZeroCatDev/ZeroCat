/**
 * 需要认证的路由配置
 * 支持精确匹配、前缀匹配、正则匹配等多种匹配模式
 */

// 需要登录的路由匹配规则
export const authRequiredRoutes = [
  // 精确匹配
  {
    type: 'exact',
    path: '/app/new',
    description: '创建新项目'
  },
  {
    type: 'exact',
    path: '/app/posts/mentions',
    description: '提及我的'
  },
  {
    type: 'exact',
    path: '/app/project',
    description: '项目管理'
  },
  {
    type: 'exact',
    path: '/app/projectlist',
    description: '项目列表'
  },

  // 前缀匹配 - app/account 下的页面（除了登录相关页面）
  {
    type: 'prefix',
    path: '/app/account',
    excludes: [
      '/app/account/login',
      '/app/account/register',
      '/app/account/register/verify',
      '/app/account/retrieve',
      '/app/account/retrievecallback',
      '/app/account/magiclink',
      '/app/account/magiclink/validate',
      '/app/account/email/verify',
      '/app/account/oauth/callback',
      '/app/account/oauth/login/error',
      '/app/account/oauth/bind/success',
      '/app/account/oauth/bind/error',
      '/app/account/social/sync/twitter/success',
      '/app/account/social/sync/twitter/error',
      '/app/account/social/sync/bluesky/success',
      '/app/account/social/sync/bluesky/error'
    ],
    description: '账户管理页面'
  },

  // 前缀匹配 - OAuth 应用管理
  {
    type: 'prefix',
    path: '/app/oauth/applications',
    description: 'OAuth应用管理'
  },

  // 前缀匹配 - 扩展管理
  {
    type: 'prefix',
    path: '/app/extensions/my',
    description: '我的扩展'
  },

  // 前缀匹配 - 管理后台
  {
    type: 'prefix',
    path: '/app/admin',
    description: '管理后台'
  },

  // 动态路由匹配 - 项目相关操作
  {
    type: 'regex',
    pattern: /^\/[^\/]+\/[^\/]+\/(edit|settings|fork|push)$/,
    description: '项目编辑/设置/分支/推送'
  },

  // 精确匹配 - 评论服务创建页面
  {
    type: 'exact',
    path: '/app/commentservice/create',
    description: '创建评论服务'
  },

  // 精确匹配 - 评论服务空间页面
  {
    type: 'exact',
    path: '/app/commentservice/space',
    description: '评论服务空间'
  },

  // 动态路由匹配 - 评论服务设置页面
  {
    type: 'regex',
    pattern: /^\/app\/commentservice\/[^\/]+\/settings$/,
    description: '评论服务设置'
  },

  // 前缀匹配 - 我的评论
  {
    type: 'prefix',
    path: '/app/commentservice/my',
    description: '我的评论'
  }
];

/**
 * 检查路径是否需要认证
 * @param {string} path 当前路径
 * @returns {boolean} 是否需要认证
 */
export function requiresAuth(path) {
  return authRequiredRoutes.some(route => {
    switch (route.type) {
      case 'exact':
        return path === route.path;

      case 'prefix':
        if (!path.startsWith(route.path)) {
          return false;
        }
        // 检查排除列表
        if (route.excludes) {
          return !route.excludes.some(exclude => path.startsWith(exclude));
        }
        return true;

      case 'regex':
        return route.pattern.test(path);

      default:
        return false;
    }
  });
}

/**
 * 获取匹配的路由规则信息
 * @param {string} path 当前路径
 * @returns {object|null} 匹配的路由规则
 */
export function getMatchedRoute(path) {
  return authRequiredRoutes.find(route => {
    switch (route.type) {
      case 'exact':
        return path === route.path;

      case 'prefix':
        if (!path.startsWith(route.path)) {
          return false;
        }
        if (route.excludes) {
          return !route.excludes.some(exclude => path.startsWith(exclude));
        }
        return true;

      case 'regex':
        return route.pattern.test(path);

      default:
        return false;
    }
  }) || null;
}
