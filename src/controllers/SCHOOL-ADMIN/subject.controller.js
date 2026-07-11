const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req)
        const search = req.query.search;

        const where = {
            schoolId: req.user.schoolId,
            // sessionId: currentSession.id,

            ...(search && {
                OR: [
                    {
                        subjectName: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        subjectCode: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                ],
            }),
        };

        const totalSubjects = await prisma.subject.count({
            where,
        });

        const subjects = await prisma.subject.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,

            orderBy: {
                createdAt: "desc",
            },
        });

        const totalPages = Math.ceil(totalSubjects / limit);

        return res.status(200).json({
            success: true,
            message: "Subjects fetched successfully.",
            // session: {
            //     id: currentSession.id,
            //     sessionName: currentSession.sessionName,
            // },
            data: subjects,

            pagination: getPaginationMeta(page, limit, totalSubjects)
        });
    } catch (error) {
        console.error("Index Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error.",
        });
    }
};


exports.getAllSubjects = async (req, res) => {
  try {
    const { classId, sectionId } = req.query;

    const where = {
      schoolId: req.user.schoolId,
      status: true,
    };

    if (classId) {
      where.classId = classId;
    }

    if (sectionId) {
      where.sectionId = sectionId;
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: {
        subjectName: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Subjects fetched successfully.",
      data: subjects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.store = async (req, res) => {
    try {
        let { subjectName, subjectCode, shortName, description } = req.body;

        if (!subjectName?.trim() || !subjectCode?.trim() || !shortName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject  shortName name and subject code are required."
            });
        }

        subjectName = subjectName.trim();

        subjectCode = subjectCode.trim().toUpperCase();
        shortName = shortName.trim().toUpperCase();

        const currentSession = await prisma.academicSession.findFirst({
            where: {
                schoolId: req.user.schoolId,
                isCurrent: true,
            },
        });

        if (!currentSession) {
            return res.status(404).json({
                success: false,
                message: "Current academic session not found.",
            });
        }

        // Check duplicate Subject Name or Code
        const existingSubject = await prisma.subject.findFirst({
            where: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                OR: [
                    {
                        subjectCode
                    },
                    {
                        subjectName: {
                            equals: subjectName,
                            mode: "insensitive"
                        }
                    }
                ]
            }
        });

         if (existingSubject) {
            return res.status(409).json({
                success: false,
                message:
                    existingSubject.subjectCode.toUpperCase() === subjectCode
                        ? "Subject code already exists in the current academic session."
                        : "Subject name already exists in the current academic session."
            });
        }

        const subject = await prisma.subject.create({
            data: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                subjectName,
                subjectCode,
                shortName,
                description,
                sessionId: currentSession.id || null
            }
        });

        return res.status(201).json({
            success: true,
            message: "Subject created successfully.",
            data: subject
        });

    } catch (error) {
        console.error("Store Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.status = async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await prisma.subject.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
              
            },
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found or does not belong to the current academic session.",
            });
        }

        const updatedSubject = await prisma.subject.update({
            where: {
                id,
            },
            data: {
                status: !subject.status,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Subject ${updatedSubject.status ? "activated" : "deactivated"} successfully.`,
            data: updatedSubject,
        });

    } catch (error) {
        console.error("Change Subject Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error.",
        });
    }
};

exports.show = async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await prisma.subject.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId
            },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "subject not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: subject
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        let { subjectName, subjectCode, description, shortName } = req.body;

        if (!subjectName?.trim() || !subjectCode?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject name and subject code are required."
            });
        }

        const currentSession = await prisma.academicSession.findFirst({
            where: {
                schoolId: req.user.schoolId,
                isCurrent: true,
            },
        });

        if (!currentSession) {
            return res.status(404).json({
                success: false,
                message: "Current academic session not found.",
            });
        }

        subjectName = subjectName.trim();
        subjectCode = subjectCode.trim().toUpperCase();

        const subject = await prisma.subject.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
            },
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found."
            });
        }

        // Check duplicate (excluding current subject)
        const existingSubject = await prisma.subject.findFirst({
            where: {
                schoolId: req.user.schoolId,
                NOT: {
                    id,
                },
                OR: [
                    {
                        subjectCode,
                    },
                    {
                        subjectName: {
                            equals: subjectName,
                            mode: "insensitive",
                        },
                    },
                ],
            },
        });

        if (existingSubject) {
            return res.status(409).json({
                success: false,
                message:
                    existingSubject.subjectCode === subjectCode
                        ? "Subject code already exists."
                        : "Subject name already exists.",
            });
        }

        const updatedSubject = await prisma.subject.update({
            where: {
                id,
            },
            data: {
                subjectName,
                subjectCode,
                description,
                shortName,
                sessionId: currentSession.id || null
            },
        });

        return res.status(200).json({
            success: true,
            message: "Subject updated successfully.",
            data: updatedSubject,
        });

    } catch (error) {
        console.error("Update Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await prisma.subject.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
            },
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: "Subject not found.",
            });
        }

        // Check if subject is assigned to any teacher
        const assignedSubject = await prisma.teacherSubject.findFirst({
            where: {
                subjectId: id,
            },
        });

        if (assignedSubject) {
            return res.status(400).json({
                success: false,
                message: "Subject is assigned to a teacher and cannot be deleted.",
            });
        }

        await prisma.subject.delete({
            where: {
                id,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Subject deleted successfully.",
        });

    } catch (error) {
        console.error("Delete Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};