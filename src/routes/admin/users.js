import {Router} from "express";
import {prisma} from "../../services/prisma.js";

const router = Router();

/**
 * @api {get} /admin/users List users with pagination, sorting and filtering
 * @apiName GetUsers
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiQuery {Number} page Current page number (1-based)
 * @apiQuery {Number} itemsPerPage Items per page
 * @apiQuery {String} sortBy Field to sort by
 * @apiQuery {String} sortDesc Sort direction (true for descending)
 * @apiQuery {String} search Search term for username/email/display_name
 * @apiQuery {String} status Filter by status
 * @apiQuery {String} type Filter by user type
 *
 * @apiSuccess {Object[]} items List of users
 * @apiSuccess {Number} total Total number of users matching filters
 */
router.get("/", async (req, res) => {
    try {
        const {
            page = 1,
            itemsPerPage = 10,
            sortBy = "id",
            sortDesc = false,
            search = "",
            status,
            type,
        } = req.query;

        // Build filter conditions
        const where = {
            AND: [
                {
                    OR: [
                        {username: {contains: search}},
                        {email: {contains: search}},
                        {display_name: {contains: search}},
                    ],
                },
            ],
        };

        if (status) {
            where.AND.push({status});
        }

        if (type) {
            where.AND.push({type});
        }

        // Build sort object
        const orderBy = {
            [sortBy]: sortDesc ? "desc" : "asc",
        };

        // Execute query with pagination
        const [items, total] = await Promise.all([
            prisma.ow_users.findMany({
                where,
                orderBy,
                skip: (page - 1) * itemsPerPage,
                take: Number(itemsPerPage),
                select: {
                    id: true,
                    username: true,
                    email: true,
                    display_name: true,
                    status: true,
                    type: true,
                    regTime: true,
                    loginTime: true,
                    avatar: true,
                    location: true,
                    region: true,
                    url: true,
                    motto: true,
                    bio: true,
                    birthday: true,
                    sex: true,
                    custom_status: true,
                    featured_projects: true,
                },
            }),
            prisma.ow_users.count({where}),
        ]);

        res.json({
            items,
            total,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {get} /admin/users/:id Get user details
 * @apiName GetUser
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 *
 * @apiSuccess {Object} user User details
 */
router.get("/:id", async (req, res) => {
    try {
        const user = await prisma.ow_users.findUnique({
            where: {id: parseInt(req.params.id)},
            include: {
                contacts: true,
                authored_projects: {
                    select: {
                        id: true,
                        name: true,
                        title: true,
                        state: true,
                        time: true,
                    },
                },
                auth_tokens: {
                    select: {
                        id: true,
                        created_at: true,
                        last_used_at: true,
                        last_used_ip: true,
                        user_agent: true,
                        revoked: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({error: "User not found"});
        }

        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {post} /admin/users Create new user
 * @apiName CreateUser
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiBody {String} username Username
 * @apiBody {String} email Email address
 * @apiBody {String} password Password
 * @apiBody {String} display_name Display name
 * @apiBody {String} type User type
 * @apiBody {String} status User status
 */
router.post("/", async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            display_name,
            type = "user",
            status = "active",
        } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({error: "Missing required fields"});
        }

        // Check for existing username/email
        const existing = await prisma.ow_users.findFirst({
            where: {
                OR: [{username}, {email}],
            },
        });

        if (existing) {
            return res
                .status(400)
                .json({error: "Username or email already exists"});
        }

        // Create user
        const user = await prisma.ow_users.create({
            data: {
                username,
                email,
                password, // Note: Ensure password is hashed before saving
                display_name: display_name || username,
                type,
                status,
                regTime: new Date(),
                loginTime: new Date(),
            },
        });

        res.status(201).json(user);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {put} /admin/users/:id Update user
 * @apiName UpdateUser
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {Object} updates Fields to update
 * @apiBody {String} [updates.display_name] Display name
 * @apiBody {String} [updates.email] Primary email address
 * @apiBody {String} [updates.status] User status (active, suspended, banned, pending)
 * @apiBody {String} [updates.type] User type (user, admin, etc)
 * @apiBody {String} [updates.motto] One-line introduction
 * @apiBody {String} [updates.bio] Markdown biography
 * @apiBody {String} [updates.location] User location
 * @apiBody {String} [updates.region] User region
 * @apiBody {String} [updates.birthday] User birthday (ISO date string)
 * @apiBody {String} [updates.sex] User gender
 * @apiBody {String} [updates.url] User website URL
 * @apiBody {Object} [updates.custom_status] Custom status object with emoji and text
 * @apiBody {Number[]} [updates.featured_projects] Array of featured project IDs
 * @apiBody {String} [updates.avatar] Avatar URL/hash
 * @apiBody {Object[]} [updates.contacts] Array of contact objects
 * @apiBody {String} updates.contacts[].contact_type Contact type (email, phone, etc)
 * @apiBody {String} updates.contacts[].contact_value Contact value
 * @apiBody {Boolean} updates.contacts[].is_primary Whether this is primary contact
 * @apiBody {Boolean} updates.contacts[].verified Whether contact is verified
 */
router.put("/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const updates = req.body;

        // Validate user exists
        const existingUser = await prisma.ow_users.findUnique({
            where: {id: userId},
            include: {
                contacts: true,
            },
        });

        if (!existingUser) {
            return res.status(404).json({error: "User not found"});
        }

        // Check username uniqueness if it's being updated
        if (updates.username && updates.username !== existingUser.username) {
            const usernameExists = await prisma.ow_users.findFirst({
                where: {
                    username: updates.username,
                    NOT: {
                        id: userId
                    }
                }
            });

            if (usernameExists) {
                return res.status(400).json({error: "Username already exists"});
            }
        }

        // Remove sensitive fields that shouldn't be updated directly
        delete updates.id;
        delete updates.regTime;
        delete updates.password; // Password should be handled separately with proper hashing

        // Handle contact updates if provided
        if (updates.contacts) {
            // Validate contacts array
            if (!Array.isArray(updates.contacts)) {
                return res.status(400).json({error: "Contacts must be an array"});
            }

            // Process each contact
            await Promise.all(
                updates.contacts.map((contact) =>
                    prisma.ow_users_contacts.upsert({
                        where: {
                            contact_value: contact.contact_value,
                        },
                        update: {
                            contact_type: contact.contact_type,
                            contact_info: contact.contact_info,
                            is_primary: contact.is_primary,
                            verified: contact.verified,
                            metadata: contact.metadata,
                            updated_at: new Date(),
                        },
                        create: {
                            user_id: userId,
                            contact_type: contact.contact_type,
                            contact_value: contact.contact_value,
                            contact_info: contact.contact_info,
                            is_primary: contact.is_primary,
                            verified: contact.verified,
                            metadata: contact.metadata,
                        },
                    })
                )
            );

            // Remove contacts from updates object as it's handled separately
            delete updates.contacts;
        }

        // Handle avatar update
        if (updates.avatar) {
            updates.images = updates.avatar; // Update both avatar and images fields
        }

        // Clean up empty strings and handle special fields
        const cleanUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            // Skip empty strings for optional fields
            if (value === "") {
                continue;
            }

            // Handle special fields
            switch (key) {
                case "birthday":
                    // Only set birthday if it's a valid date string
                    if (value && Date.parse(value)) {
                        cleanUpdates[key] = new Date(value);
                    }
                    break;
                case "custom_status":
                    // Only include custom_status if it has non-empty values
                    if (value && (value.emoji || value.text)) {
                        cleanUpdates[key] = value;
                    }
                    break;
                case "featured_projects":
                    // Only include if it's a non-empty array
                    if (Array.isArray(value) && value.length > 0) {
                        cleanUpdates[key] = value;
                    }
                    break;
                default:
                    cleanUpdates[key] = value;
            }
        }

        // Add updatedAt timestamp
        cleanUpdates.updatedAt = new Date();

        // Update user record
        const user = await prisma.ow_users.update({
            where: {id: userId},
            data: cleanUpdates,
            include: {
                contacts: true,
            },
        });

        res.json(user);
    } catch (error) {
        console.error("Error updating user:", error);
        res
            .status(500)
            .json({error: "Internal server error", details: error.message});
    }
});

/**
 * @api {delete} /admin/users/:id Delete user
 * @apiName DeleteUser
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 */
router.delete("/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Optional: Check if user exists
        const user = await prisma.ow_users.findUnique({
            where: {id: userId},
        });

        if (!user) {
            return res.status(404).json({error: "User not found"});
        }

        // Delete user and all related data in a transaction
        await prisma.$transaction(async (prisma) => {
            // Delete events where user is actor
            await prisma.ow_events.deleteMany({
                where: {actor_id: userId},
            });

            // Delete notifications
            await prisma.ow_notifications.deleteMany({
                where: {
                    OR: [{user_id: userId}, {actor_id: userId}],
                },
            });

            // Delete auth tokens
            await prisma.ow_auth_tokens.deleteMany({
                where: {user_id: userId},
            });

            // Delete user contacts
            await prisma.ow_users_contacts.deleteMany({
                where: {user_id: userId},
            });

            // Delete user relationships
            await prisma.ow_user_relationships.deleteMany({
                where: {
                    OR: [{source_user_id: userId}, {target_user_id: userId}],
                },
            });

            // Delete OAuth related data
            await prisma.ow_oauth_access_tokens.deleteMany({
                where: {user_id: userId},
            });

            await prisma.ow_oauth_authorizations.deleteMany({
                where: {user_id: userId},
            });

            // Delete user's OAuth applications
            await prisma.ow_oauth_applications.deleteMany({
                where: {owner_id: userId},
            });

            // Delete user's comments
            await prisma.ow_comment.deleteMany({
                where: {user_id: userId},
            });

            // Delete user's KV store data
            await prisma.ow_cache_kv.deleteMany({
                where: {user_id: userId},
            });

            // Finally delete the user
            await prisma.ow_users.delete({
                where: {id: userId},
            });
        });

        res.status(204).send();
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
});

/**
 * @api {post} /admin/users/:id/status Update user status
 * @apiName UpdateUserStatus
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {String} status New status
 */
router.post("/:id/status", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {status} = req.body;

        if (!["active", "suspended", "banned", "pending"].includes(status)) {
            return res.status(400).json({error: "Invalid status"});
        }

        const user = await prisma.ow_users.update({
            where: {id: userId},
            data: {
                status,
                updatedAt: new Date(),
            },
        });

        res.json(user);
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {get} /admin/users/stats/overview Get user statistics
 * @apiName GetUserStats
 * @apiGroup AdminUsers
 * @apiPermission admin
 */
router.get("/stats/overview", async (req, res) => {
    try {
        const stats = await prisma.$transaction([
            // Total users
            prisma.ow_users.count(),
            // Users by status
            prisma.ow_users.groupBy({
                by: ["status"],
                _count: true,
            }),
            // Users by type
            prisma.ow_users.groupBy({
                by: ["type"],
                _count: true,
            }),
            // New users in last 7 days
            prisma.ow_users.count({
                where: {
                    regTime: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        res.json({
            totalUsers: stats[0],
            usersByStatus: stats[1],
            usersByType: stats[2],
            newUsersLast7Days: stats[3],
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {put} /admin/users/:id/profile Update user profile
 * @apiName UpdateUserProfile
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {Object} profile Profile fields to update
 */
router.put("/:id/profile", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {
            display_name,
            motto,
            bio,
            location,
            region,
            birthday,
            sex,
            url,
            custom_status,
            featured_projects,
        } = req.body;

        const user = await prisma.ow_users.update({
            where: {id: userId},
            data: {
                display_name: display_name,
                motto: motto,
                bio: bio,
                location: location,
                region: region,
                birthday: birthday ? new Date(birthday) : undefined,
                sex: sex,
                url: url,
                custom_status: custom_status,
                featured_projects: featured_projects,
                updatedAt: new Date(),
            },
        });

        res.json(user);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {put} /admin/users/:id/avatar Update user avatar
 * @apiName UpdateUserAvatar
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {String} avatar Avatar URL or identifier
 */
router.put("/:id/avatar", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {avatar} = req.body;

        const user = await prisma.ow_users.update({
            where: {id: userId},
            data: {
                avatar: avatar,
                images: avatar, // Update both avatar and images fields
                updatedAt: new Date(),
            },
        });

        res.json(user);
    } catch (error) {
        console.error("Error updating user avatar:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {put} /admin/users/:id/contacts Update user contact information
 * @apiName UpdateUserContacts
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {Object[]} contacts Array of contact objects
 */
router.put("/:id/contacts", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {contacts} = req.body;

        // Validate contacts array
        if (!Array.isArray(contacts)) {
            return res.status(400).json({error: "Contacts must be an array"});
        }

        // Update or create contacts
        const updatedContacts = await Promise.all(
            contacts.map((contact) =>
                prisma.ow_users_contacts.upsert({
                    where: {
                        contact_value: contact.contact_value,
                    },
                    update: {
                        contact_type: contact.contact_type,
                        contact_info: contact.contact_info,
                        is_primary: contact.is_primary,
                        verified: contact.verified,
                        metadata: contact.metadata,
                        updated_at: new Date(),
                    },
                    create: {
                        user_id: userId,
                        contact_type: contact.contact_type,
                        contact_value: contact.contact_value,
                        contact_info: contact.contact_info,
                        is_primary: contact.is_primary,
                        verified: contact.verified,
                        metadata: contact.metadata,
                    },
                })
            )
        );

        res.json(updatedContacts);
    } catch (error) {
        console.error("Error updating user contacts:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {get} /admin/users/:id/activity Get user activity
 * @apiName GetUserActivity
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 */
router.get("/:id/activity", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const activity = await prisma.$transaction([
            // Get recent events
            prisma.ow_events.findMany({
                where: {actor_id: userId},
                orderBy: {created_at: "desc"},
                take: 10,
            }),
            // Get recent notifications
            prisma.ow_notifications.findMany({
                where: {user_id: userId},
                orderBy: {created_at: "desc"},
                take: 10,
            }),
            // Get auth tokens
            prisma.ow_auth_tokens.findMany({
                where: {user_id: userId},
                orderBy: {last_used_at: "desc"},
                take: 5,
            }),
            // Get analytics events
            prisma.ow_analytics_event.findMany({
                where: {user_id: userId},
                orderBy: {created_at: "desc"},
                take: 10,
                include: {
                    device: true,
                },
            }),
        ]);

        res.json({
            events: activity[0],
            notifications: activity[1],
            auth_tokens: activity[2],
            analytics: activity[3],
        });
    } catch (error) {
        console.error("Error fetching user activity:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {get} /admin/users/:id/relationships Get user relationships
 * @apiName GetUserRelationships
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 */
router.get("/:id/relationships", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const relationships = await prisma.$transaction([
            // Get followers
            prisma.ow_user_relationships.findMany({
                where: {
                    target_user_id: userId,
                    relationship_type: "follow",
                },
                include: {
                    source_user: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            avatar: true,
                        },
                    },
                },
            }),
            // Get following
            prisma.ow_user_relationships.findMany({
                where: {
                    source_user_id: userId,
                    relationship_type: "follow",
                },
                include: {
                    target_user: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            avatar: true,
                        },
                    },
                },
            }),
            // Get blocked users
            prisma.ow_user_relationships.findMany({
                where: {
                    source_user_id: userId,
                    relationship_type: "block",
                },
                include: {
                    target_user: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                        },
                    },
                },
            }),
        ]);

        res.json({
            followers: relationships[0],
            following: relationships[1],
            blocked: relationships[2],
        });
    } catch (error) {
        console.error("Error fetching user relationships:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {get} /admin/users/:id/connections Get user connections
 * @apiName GetUserConnections
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiQuery {String} [type] Filter by connection type (e.g. oauth_github, email, phone)
 *
 * @apiSuccess {Object[]} connections List of user connections
 */
router.get("/:id/connections", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {type} = req.query;

        // Build where clause
        const where = {
            user_id: userId,
        };

        // Add type filter if provided
        if (type) {
            where.contact_type = type;
        }

        const connections = await prisma.ow_users_contacts.findMany({
            where,
            orderBy: {
                created_at: "desc",
            },
        });

        res.json(connections);
    } catch (error) {
        console.error("Error fetching user connections:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {post} /admin/users/:id/connections Add OAuth connection
 * @apiName AddUserConnection
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiBody {String} type OAuth provider type (oauth_github, oauth_google, etc)
 * @apiBody {String} value OAuth provider user ID or unique identifier
 * @apiBody {Object} [info] Additional connection info
 * @apiBody {Object} [metadata] Additional metadata
 */
router.post("/:id/connections", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const {contact_type, contact_value, contact_info, metadata} = req.body;

        // Validate required fields
        if (!contact_type || !contact_value) {
            return res.status(400).json({error: "Missing required fields"});
        }

        // Check for existing connection
        const existing = await prisma.ow_users_contacts.findUnique({
            where: {
                contact_value: contact_value,
            },
        });

        if (existing) {
            return res.status(400).json({error: "Connection already exists"});
        }

        // Create connection
        const connection = await prisma.ow_users_contacts.create({
            data: {
                user_id: userId,
                contact_type: contact_type,
                contact_value: contact_value,
                contact_info: contact_info,
                metadata: metadata,
                verified: true, // OAuth connections are verified by default
                created_at: new Date(),
                updated_at: new Date(),
            },
        });

        res.status(201).json(connection);
    } catch (error) {
        console.error("Error creating connection:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {put} /admin/users/:id/connections/:connectionId Update connection
 * @apiName UpdateUserConnection
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiParam {Number} connectionId Connection ID
 * @apiBody {String} [contact_type] Connection type (oauth_github, email, phone, etc)
 * @apiBody {String} [contact_value] Connection value (email address, phone number, OAuth ID etc)
 * @apiBody {Object} [contact_info] Additional connection info
 * @apiBody {Object} [metadata] Additional metadata
 * @apiBody {Boolean} [verified] Update verification status
 */
router.put("/:id/connections/:connectionId", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const connectionId = parseInt(req.params.connectionId);
        const {contact_info, contact_value, contact_type, metadata, verified} =
            req.body;

        // Verify connection exists and belongs to user
        const existing = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_id: connectionId,
                user_id: userId,
            },
        });

        if (!existing) {
            return res.status(404).json({error: "Connection not found"});
        }

        // Update connection
        const connection = await prisma.ow_users_contacts.update({
            where: {
                contact_id: connectionId,
            },
            data: {
                contact_info: contact_info,
                contact_value: contact_value,
                contact_type: contact_type,
                metadata: metadata,
                verified: verified,
                updated_at: new Date(),
            },
        });

        res.json(connection);
    } catch (error) {
        console.error("Error updating connection:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

/**
 * @api {delete} /admin/users/:id/connections/:connectionId Delete connection
 * @apiName DeleteUserConnection
 * @apiGroup AdminUsers
 * @apiPermission admin
 *
 * @apiParam {Number} id User ID
 * @apiParam {Number} connectionId Connection ID
 */
router.delete("/:id/connections/:connectionId", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const connectionId = parseInt(req.params.connectionId);

        // Verify connection exists and belongs to user
        const existing = await prisma.ow_users_contacts.findFirst({
            where: {
                contact_id: connectionId,
                user_id: userId,
            },
        });

        if (!existing) {
            return res.status(404).json({error: "Connection not found"});
        }

        // Delete connection
        await prisma.ow_users_contacts.delete({
            where: {
                contact_id: connectionId,
            },
        });

        res.status(204).send();
    } catch (error) {
        console.error("Error deleting connection:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

export default router;
