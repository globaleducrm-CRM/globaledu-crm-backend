const { PrismaClient } = require('@prisma/client');



const prisma = new PrismaClient();


// get All User
exports.index = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const [users, totalUsers] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: {
                    id: "asc",
                },
                omit: {
                    password: true,
                },
                include: {
                    role: true,       //  Role ka data
                },
            }),
            prisma.user.count(),
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


