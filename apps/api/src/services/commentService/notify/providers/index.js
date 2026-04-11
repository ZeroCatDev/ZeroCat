import email from './email.js';
import wechat from './wechat.js';
import qywx from './qywx.js';
import qq from './qq.js';
import telegram from './telegram.js';
import pushplus from './pushplus.js';
import discord from './discord.js';
import lark from './lark.js';

const allProviders = [email, wechat, qywx, qq, telegram, pushplus, discord, lark];

/**
 * 获取所有 provider
 */
export function getAllProviders() {
    return allProviders;
}

/**
 * 获取已启用的 provider 列表（开关打开 + 配置就绪）
 */
export function getEnabledProviders(spaceConfig) {
    return allProviders.filter(p => p.isConfigured(spaceConfig));
}
