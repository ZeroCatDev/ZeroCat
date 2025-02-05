import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createEvent(eventType, actorId, targetType, targetId, eventData, isPublic = 1, eventTime = null) {
    try {
        await prisma.events.create({
            data: {
                event_type: eventType,
                actor_id: BigInt(actorId),
                target_type: targetType,
                target_id: BigInt(targetId),
                event_data: {
                    ...eventData,
                    page: {
                        type: targetType,
                        id: targetId,
                        ...eventData.page
                    }
                },
                public: isPublic,
                created_at: eventTime || new Date()
            }
        });
    } catch (error) {
        console.error(`Error creating ${eventType} event:`, error);
    }
}

async function updateTimeline() {
    try {
        // 处理用户注册事件
        console.log('开始处理用户注册事件...');
        const users = await prisma.ow_users.findMany({
            where: {
                NOT: {
                    regTime: null
                }
            }
        });
        
        console.log(`找到 ${users.length} 个用户记录`);
        let userCount = 0;

        for (const user of users) {
            await createEvent(
                'user_register',
                user.id,
                'user',
                user.id,
                {
                    username: user.username,
                    display_name: user.display_name,
                    register_time: user.regTime,
                },
                1,
                user.regTime
            );
            userCount++;
            if (userCount % 100 === 0) {
                console.log(`已处理 ${userCount}/${users.length} 个用户记录`);
            }
        }

        // 处理作品发布事件
        console.log('\n开始处理作品发布事件...');
        const projects = await prisma.ow_projects.findMany({
            where: {
                NOT: {
                    time: null
                }
            }
        });
        
        console.log(`找到 ${projects.length} 个作品记录`);
        let projectCount = 0;

        for (const project of projects) {
            await createEvent(
                'project_publish',
                project.authorid,
                'project',
                project.id,
                {
                    name: project.name,
                    title: project.title,
                    publish_time: project.time,
                    state: project.state,
                },
                project.state === 'private' ? 0 : 1,
                project.time
            );
            projectCount++;
            if (projectCount % 100 === 0) {
                console.log(`已处理 ${projectCount}/${projects.length} 个作品记录`);
            }
        }

        // 处理评论事件
        console.log('\n开始处理评论事件...');
        const comments = await prisma.ow_comment.findMany({
            where: {
                NOT: {
                    insertedAt: null
                }
            }
        });
        
        console.log(`找到 ${comments.length} 条评论记录`);
        let commentCount = 0;

        for (const comment of comments) {
            if (!comment.user_id) continue;

            await createEvent(
                'comment_create',
                comment.user_id,
                'comment',
                comment.id,
                {
                    comment_text: comment.text?.substring(0, 100),
                    parent_id: comment.pid,
                    reply_id: comment.rid,
                    comment_time: comment.insertedAt,
                },
                1,
                comment.insertedAt
            );
            commentCount++;
            if (commentCount % 100 === 0) {
                console.log(`已处理 ${commentCount}/${comments.length} 条评论记录`);
            }
        }

        console.log('\n时间线更新完成！');
        console.log(`总计处理：`);
        console.log(`- ${userCount} 个用户注册事件`);
        console.log(`- ${projectCount} 个作品发布事件`);
        console.log(`- ${commentCount} 条评论事件`);
    } catch (error) {
        console.error('更新时间线时出错:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateTimeline()
    .then(() => {
        console.log('更新完成，程序退出');
        process.exit(0);
    })
    .catch((error) => {
        console.error('程序执行出错:', error);
        process.exit(1);
    });

export default {
    createEvent,
    updateTimeline
};
