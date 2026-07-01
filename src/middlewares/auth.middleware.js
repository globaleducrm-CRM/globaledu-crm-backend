const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();


const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        schoolId: true,
       
        name: true,
        email: true,
        mobile: true,
        isActive: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // check if the user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account disabled",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

module.exports = authMiddleware;