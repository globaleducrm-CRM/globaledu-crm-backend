const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req)
        const search = req.query.search

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

exports.store = async (req, res) => {
    try {
        let { subjectName, subjectCode,shortName,description } = req.body;

        if (!subjectName?.trim() || !subjectCode?.trim() || !shortName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject  shortName name and subject code are required."
            });
        }

        subjectName = subjectName.trim();
        
        subjectCode = subjectCode.trim().toUpperCase();
        shortName = shortName.trim().toUpperCase();

        // Check duplicate Subject Name or Code
        const existingSubject = await prisma.subject.findFirst({
            where: {
                schoolId: req.user.schoolId,
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
                    existingSubject.subjectCode === subjectCode
                        ? "Subject code already exists."
                        : "Subject name already exists."
            });
        }

        const subject = await prisma.subject.create({
            data: {
                schoolId: req.user.schoolId,
                subjectName,
                subjectCode,
                shortName,
                description
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
                sessionId: currentSession.id,
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

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        let { subjectName, subjectCode,description,shortName } = req.body;

        if (!subjectName?.trim() || !subjectCode?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Subject name and subject code are required."
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
                shortName
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