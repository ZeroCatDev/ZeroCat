export async function emailDeliveryAllowed(options = {}) {
    if (!options.notificationId) return true;
    const [{ prisma }, { notificationCanSend }] = await Promise.all([
        import('../prisma.js'), import('../../controllers/notifications.js'),
    ]);
    const notification = await prisma.ow_notifications.findUnique({ where: { id: Number(options.notificationId) } });
    return Boolean(notification && await notificationCanSend(notification, notification.user_id));
}

export async function prepareEmailDelivery(payload, { queued = false } = {}) {
    if (!payload?.notificationId) {
        // Legacy queue snapshots have no canonical source that can be checked again.
        return payload && (!queued || payload.deliveryVersion === 1) ? payload : null;
    }
    const [{ prisma }, { notificationCanSend }] = await Promise.all([
        import('../prisma.js'), import('../../controllers/notifications.js'),
    ]);
    const notification = await prisma.ow_notifications.findUnique({ where: { id: Number(payload.notificationId) } });
    if (!notification || !await notificationCanSend(notification, notification.user_id)) return null;
    if (!notification.actor_id && !notification.target_type) return payload;
    return { ...payload, subject: '社区通知', html: '<p>你关注的内容有更新，请登录后查看通知。</p>' };
}
