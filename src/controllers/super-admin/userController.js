const { PrismaClient } = require('@prisma/client');
const { status } = require('./school.controller');




const prisma = new PrismaClient();


// get All User
exports.index = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const search = req.query.search?.trim() || "";
        const status = req.query.status || "";
        const role = req.query.role || "";

        const skip = (page - 1) * limit;

        const where = {};

        // Search
        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    mobile: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        // Status Filter
        if (status) {
            where.isActive = status === "ACTIVE";
            // Agar enum use kar rahe ho to:
            // where.status = status;
        }

        // Role Filter
        if (role) {
            where.role = {
                name: role,
            };
        }

        const [users, totalUsers] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                omit: {
                    password: true,
                },
                include: {
                    role: true,
                },
            }),

            prisma.user.count({
                where,
            }),
        ]);

        return res.status(200).json({
            success: true,
            data: users,
            pagination: {
                currentPage: page,
                perPage: limit,
                totalRecords: totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                hasNextPage: page < Math.ceil(totalUsers / limit),
                hasPreviousPage: page > 1,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};





