const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

//get Role
exports.index = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1
        const limit = Number(req.query.limit) || 10

        const skip = (page-1)* limit

         const [roles, totalRoles] = await Promise.all([
            prisma.role.findMany({
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc"
                }
            }),
            prisma.role.count()
        ]);

        
        return res.status(200).json({
            success: true,
            data: roles,
             pagination: {
                currentPage: page,
                perPage: limit,
                totalRecords: totalRoles,
                totalPages: Math.ceil(totalRoles / limit),
                hasNextPage: page < Math.ceil(totalRoles / limit),
                hasPreviousPage: page > 1,
            },
        });
    } catch (error) {
        console.error('Error retrieving roles:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    };
};

// create Role
exports.store = async (req, res) => {
    try {
         
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'Name and description are required'
            });
        }

        const roleExits = await prisma.role.findUnique({
            where: { name }
        });

        if (roleExits) {
            return res.status(400).json({
                success: false,         
                message: 'Role already exists'
            });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: role
        });
    } catch (error) {
        console.error('Error creating role:', error);
        return res.status(500).json({
            success: false,
            message: error.message ||'Internal server error'
        });
    }
};