// 导入各个控制器文件
import * as loginController from './loginController.js';
import * as registerController from './registerController.js';
import * as emailController from './emailController.js';
import * as tokenController from './tokenController.js';
// Legacy TOTP controller removed; new 2FA/passkey controllers added below
import * as twoFactorController from './twoFactorController.js';
import * as passkeyController from './passkeyController.js';
import * as oauthController from './oauthController.js';

// 集中导出所有控制器
export {
    loginController,
    registerController,
    emailController,
    tokenController,
    twoFactorController,
    passkeyController,
    oauthController
};