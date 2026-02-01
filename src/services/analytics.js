import {prisma} from "./prisma.js";

/**
 * 获取指定目标的分析数据
 * @param {string} targetType - 目标类型
 * @param {number} targetId - 目标ID
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @returns {Promise<Object>} 分析数据
 */
export async function getAnalytics(targetType, targetId, startDate, endDate) {
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    // 获取所有时间的统计数据和指定时间段的数据
    const [allTimeEvents, timeSeriesEvents] = await Promise.all([
        // 获取所有时间的事件数据（用于总体统计）
        prisma.ow_analytics_event.findMany({
            where: {
                target_type: targetType,
                target_id: targetId,
            },
            include: {
                device: true,
            },
        }),
        // 获取指定时间段的事件数据（用于时间序列显示）
        prisma.ow_analytics_event.findMany({
            where: {
                target_type: targetType,
                target_id: targetId,
                created_at: {
                    gte: startDateTime,
                    lte: endDateTime,
                },
            },
            include: {
                device: true,
            },
            orderBy: {
                created_at: 'asc',
            },
        }),
    ]);

    // 处理总体统计数据
    const processAllTimeStats = (events) => {
        const stats = {
            pageviews: events.length,
            uniqueDevices: new Set(events.map(e => e.device_id)).size,
            deviceVisits: {},
            referrers: {},
            browsers: {},
            os: {},
            devices: {},
            countries: {},
        };

        // 计算每个设备的访问次数（用于跳出率）
        events.forEach(event => {
            stats.deviceVisits[event.device_id] = (stats.deviceVisits[event.device_id] || 0) + 1;
        });

        // 处理每个事件
        events.forEach(event => {
            // 来源域名统计
            if (event.referrer_domain) {
                stats.referrers[event.referrer_domain] = (stats.referrers[event.referrer_domain] || 0) + 1;
            }

            // 浏览器统计
            if (event.device?.browser) {
                stats.browsers[event.device.browser] = (stats.browsers[event.device.browser] || 0) + 1;
            }

            // 操作系统统计
            if (event.device?.os) {
                stats.os[event.device.os] = (stats.os[event.device.os] || 0) + 1;
            }

            // 设备类型统计
            if (event.device?.device_type) {
                stats.devices[event.device.device_type] = (stats.devices[event.device.device_type] || 0) + 1;
            }

            // 国家统计
            if (event.country) {
                stats.countries[event.country] = (stats.countries[event.country] || 0) + 1;
            }
        });

        // 计算跳出数（只访问一次的设备数）
        const bounces = Object.values(stats.deviceVisits).filter(visits => visits === 1).length;

        return {
            pageviews: stats.pageviews,
            visitors: stats.uniqueDevices,
            bounces,
            stats,
        };
    };

    // 处理时间序列数据
    const processTimeSeriesStats = (events) => {
        const hourlyStats = {};

        events.forEach(event => {
            const hour = event.created_at.toISOString().slice(0, 13) + ':00:00';
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = {
                    pageviews: 0,
                    devices: new Set(),
                };
            }
            hourlyStats[hour].pageviews++;
            hourlyStats[hour].devices.add(event.device_id);
        });

        return hourlyStats;
    };

    // 格式化统计数据
    const formatDictToStats = (dict) => {
        return Object.entries(dict).map(([key, value]) => ({
            x: key,
            y: value,
        })).sort((a, b) => b.y - a.y); // 按计数降序排序
    };

    // 格式化时间序列数据
    const formatHourlyStats = (hourlyStats) => {
        const sortedHours = Object.keys(hourlyStats).sort();
        return {
            pageviews: sortedHours.map(hour => ({
                x: hour,
                y: hourlyStats[hour].pageviews,
            })),
            sessions: sortedHours.map(hour => ({
                x: hour,
                y: hourlyStats[hour].devices.size,
            })),
        };
    };

    // 处理总体统计数据
    const allTimeStats = processAllTimeStats(allTimeEvents);

    // 处理时间序列数据
    const timeSeriesStats = processTimeSeriesStats(timeSeriesEvents);

    return {
        overview: {
            pageviews: {
                value: allTimeStats.pageviews,
                prev: 0, // 不再需要比较
            },
            visitors: {
                value: allTimeStats.visitors,
                prev: 0,
            },
            visits: {
                value: allTimeStats.visitors,
                prev: 0,
            },
            bounces: {
                value: allTimeStats.bounces,
                prev: 0,
            },

        },
        referrers: formatDictToStats(allTimeStats.stats.referrers),
        browsers: formatDictToStats(allTimeStats.stats.browsers),
        os: formatDictToStats(allTimeStats.stats.os),
        devices: formatDictToStats(allTimeStats.stats.devices),
        countries: formatDictToStats(allTimeStats.stats.countries),
        timeseries: formatHourlyStats(timeSeriesStats),
    };
}