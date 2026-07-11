const { PrismaClient } = require('@prisma/client');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);

        const search = req.query.search?.trim() || "";
        const sessionId = req.query.sessionId;
        const schoolId = req.user.schoolId;

        // Get Current Active Session
        // const currentSession = await prisma.academicSession.findFirst({
        //     where: {
        //         schoolId,
        //         isCurrent: true
        //     }
        // });



        // if (!currentSession) {
        //     return res.status(404).json({
        //         success: false,
        //         message: "No active academic session found."
        //     });
        // }

       
        // Where Condition
        const where = {
            schoolId,
            //  sessionId: sessionId || currentSession.id,
        };

        if (search) {
            where.OR = [
                {
                    className: {
                        contains: search,
                        mode: "insensitive"
                    }
                },
                {
                    sortName: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];

            // Search by classOrder if search is a number
            if (!isNaN(Number(search))) {
                where.OR.push({
                    classOrder: Number(search)
                });
            }
        }

        // Total Count
        const totalClasses = await prisma.class.count({
            where
        });

        const classes = await prisma.class.findMany({
            where,
            include: {
                session: {
                    select: {
                        sessionName: true
                    }
                }
            },
            orderBy: {
                classOrder: "asc"
            },
            skip,
            take: limit
        });

        const totalPages = Math.ceil(totalClasses / limit);

        return res.status(200).json({
            success: true,
            message: "Classes fetched successfully.",
            data: classes,

            pagination: getPaginationMeta(page, limit, totalClasses),
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


exports.store = async (req, res) => {
    try {

        const { className, classOrder, sortName } = req.body;
        const schoolId = req.user.schoolId;

        // Validation
        if (!className) {
            return res.status(400).json({
                success: false,
                message: "Class name is required."
            });
        }

        // Get Current Active Session
        const session = await prisma.academicSession.findFirst({
            where: {
                schoolId,
                isCurrent: true
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No active academic session found."
            });
        }

        // Check Duplicate
        const existingClass = await prisma.class.findFirst({
            where: {
                schoolId,
                sessionId: session.id,
                className: className.trim()
            }
        });

        if (existingClass) {
            return res.status(409).json({
                success: false,
                message: "Class already exists."
            });
        }

        const generatedSortName = sortName?.trim() || className.trim().substring(0, 3).toUpperCase();
        // Create Class
        const newClass = await prisma.class.create({
            data: {
                schoolId,
                sessionId: session.id,
                className: className.trim(),
                sortName: generatedSortName,
                classOrder: classOrder ?? null
            }
        });

        return res.status(201).json({
            success: true,
            message: "Class created successfully.",
            data: newClass
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


exports.update = async (req, res) => {
    try {

        const { id } = req.params;
        const { className, classOrder, status } = req.body;
        const schoolId = req.user.schoolId;

        // Find Class
        const existingClass = await prisma.class.findFirst({
            where: {
                id,
                schoolId
            }
        });

        if (!existingClass) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // Duplicate Check
        if (className) {
            const duplicate = await prisma.class.findFirst({
                where: {
                    schoolId,
                    sessionId: existingClass.sessionId,
                    className: className.trim(),
                    NOT: {
                        id
                    }
                }
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Class already exists."
                });
            }
        }

        // Update Class
        const updatedClass = await prisma.class.update({
            where: {
                id
            },
            data: {
                className: className?.trim(),
                classOrder,
                status
            }
        });

        return res.status(200).json({
            success: true,
            message: "Class updated successfully.",
            data: updatedClass
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;

        // Check Class
        const existingClass = await prisma.class.findFirst({
            where: {
                id,
                schoolId
            }
        });

        if (!existingClass) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // Check Sections
        const sectionCount = await prisma.section.count({
            where: {
                classId: id
            }
        });

        if (sectionCount > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete class. Sections exist under this class."
            });
        }

        // Check Students
        const studentCount = await prisma.student.count({
            where: {
                classId: id
            }
        });

        if (studentCount > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete class. Students exist under this class."
            });
        }

        // Delete
        await prisma.class.delete({
            where: {
                id
            }
        });

        return res.status(200).json({
            success: true,
            message: "Class deleted successfully."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


exports.status = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;

        // Check Class
        const existingClass = await prisma.class.findFirst({
            where: {
                id,
                schoolId
            }
        });

        if (!existingClass) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // Toggle Status
        const updatedClass = await prisma.class.update({
            where: {
                id
            },
            data: {
                status: !existingClass.status
            }
        });

        return res.status(200).json({
            success: true,
            message: `Class ${updatedClass.status ? "activated" : "deactivated"} successfully.`,
            data: updatedClass
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

exports.getAllClass = async (req, res) => {
  try {
     
    // Classes of Current Session
    const classes = await prisma.class.findMany({
      where: {
        schoolId: req.user.schoolId,
        
        status:true
      },
      orderBy: {
        classOrder: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Classes fetched successfully.",
      data: classes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};