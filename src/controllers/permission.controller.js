const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany();
        return res.status(200).json({
            success: true,
            data: permissions,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

exports.store = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).json({
                message: 'Name and description are required'
            });
        }

        const permission = await prisma.permission.create({
            data: {
                name,
                description
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Permission created successfully',
            data: permission
        });
    } catch (error) {
        console.error('Error creating permission:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};