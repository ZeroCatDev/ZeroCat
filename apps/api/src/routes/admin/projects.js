import {prisma} from '../../services/prisma.js';
import express from 'express';

const router = express.Router();

// Get projects with filtering, sorting and pagination
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'id',
            sortOrder = 'asc',
            search,
            state,
            type,
            authorid,
        } = req.query;

        // Build where clause based on filters
        const where = {};
        if (search) {
            where.OR = [
                {name: {contains: search}},
                {title: {contains: search}},
                {description: {contains: search}}
            ];
        }
        if (state) where.state = state;
        if (type) where.type = type;
        if (authorid) where.authorid = parseInt(authorid);

        // Get total count for pagination
        const total = await prisma.ow_projects.count({where});

        // Get projects with sorting and pagination
        const projects = await prisma.ow_projects.findMany({
            where,
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true
                    }
                }
            },
            orderBy: {
                [sortBy]: sortOrder.toLowerCase()
            },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
        });

        res.json({
            data: projects,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

// Get single project by ID
router.get('/:id', async (req, res) => {
    try {
        const project = await prisma.ow_projects.findUnique({
            where: {id: parseInt(req.params.id)},
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true
                    }
                },
                stars: true,
                lists: true,
                commits: true,
                branches: true,
                project_tags: true
            }
        });

        if (!project) {
            return res.status(404).json({error: 'Project not found'});
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

// Update project
router.put('/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const updateData = req.body;

        // Remove id as it's the primary key and shouldn't be updated
        delete updateData.id;

        // Validate the update data against the schema
        const allowedFields = [
            'name', 'default_branch', 'type', 'license', 'thumbnail',
            'authorid',  'state', 'view_count',
            'like_count', 'favo_count', 'time', 'title',
            'description', 'history',
            'fork', 'star_count'
        ];

        // Convert specific fields to their correct types
        if (updateData.authorid) updateData.authorid = parseInt(updateData.authorid);
        if (updateData.view_count) updateData.view_count = parseInt(updateData.view_count);
        if (updateData.like_count) updateData.like_count = parseInt(updateData.like_count);
        if (updateData.favo_count) updateData.favo_count = parseInt(updateData.favo_count);
        if (updateData.star_count) updateData.star_count = parseInt(updateData.star_count);
        if (updateData.fork) updateData.fork = parseInt(updateData.fork);
        if (updateData.time) updateData.time = new Date(updateData.time);
        if (updateData.history !== undefined) updateData.history = Boolean(updateData.history);

        // Filter out any fields that aren't in the allowed list
        const validUpdateData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {});

        const updatedProject = await prisma.ow_projects.update({
            where: {id: projectId},
            data: validUpdateData,
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true
                    }
                },
                stars: true,
                branches: true,
                project_tags: true
            }
        });

        res.json(updatedProject);
    } catch (error) {
        console.error('Error updating project:', error);
        if (error.code === 'P2025') {
            res.status(404).json({error: 'Project not found'});
        } else if (error.code === 'P2003') {
            res.status(400).json({error: 'Invalid reference. Make sure the authorid exists.'});
        } else {
            res.status(500).json({error: 'Internal server error'});
        }
    }
});

// Delete project
router.delete('/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);

        // First delete related records
        await prisma.$transaction([
            prisma.ow_projects_stars.deleteMany({
                where: {projectid: projectId}
            }),
            prisma.ow_projects_list_items.deleteMany({
                where: {projectid: projectId}
            }),
            prisma.ow_projects_commits.deleteMany({
                where: {project_id: projectId}
            }),
            prisma.ow_projects_branch.deleteMany({
                where: {projectid: projectId}
            }),
            prisma.ow_projects_tags.deleteMany({
                where: {projectid: projectId}
            }),
            prisma.ow_projects.delete({
                where: {id: projectId}
            })
        ]);

        res.json({message: 'Project deleted successfully'});
    } catch (error) {
        console.error('Error deleting project:', error);
        if (error.code === 'P2025') {
            res.status(404).json({error: 'Project not found'});
        } else {
            res.status(500).json({error: 'Internal server error'});
        }
    }
});

// Get project statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await prisma.$transaction([
            // Total projects count
            prisma.ow_projects.count(),
            // Projects by state
            prisma.ow_projects.groupBy({
                by: ['state'],
                _count: true
            }),
            // Projects by type
            prisma.ow_projects.groupBy({
                by: ['type'],
                _count: true
            }),
            // Most viewed projects
            prisma.ow_projects.findMany({
                orderBy: {view_count: 'desc'},
                take: 5,
                select: {
                    id: true,
                    name: true,
                    title: true,
                    view_count: true
                }
            }),
            // Most starred projects
            prisma.ow_projects.findMany({
                orderBy: {star_count: 'desc'},
                take: 5,
                select: {
                    id: true,
                    name: true,
                    title: true,
                    star_count: true
                }
            })
        ]);

        res.json({
            totalProjects: stats[0],
            projectsByState: stats[1],
            projectsByType: stats[2],
            mostViewed: stats[3],
            mostStarred: stats[4]
        });
    } catch (error) {
        console.error('Error fetching project stats:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

export default router;
