const prisma = require('../config/prisma')

const hasPermission = (permission) => {
    return async(req,res,next) => {
        try {
            // Check if the user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            // Check if the user has the required permission
            const userPermissions = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            if (!userPermissions || !userPermissions.permissions.includes(permission)) {
                return res.status(403).json({ message: 'Access denied' });
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };
};

module.exports = hasPermission;