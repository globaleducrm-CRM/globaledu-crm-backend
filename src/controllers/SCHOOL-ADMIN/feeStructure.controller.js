
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

exports.loadFeeStructure = async (req, res) => {
    try {
        const { sessionId, classId } = req.params;
        const { studentId } = req.query;

        if (!sessionId || !classId) {
            return res.status(400).json({
                success: false,
                message: "Session and Class are required.",
            });
        }

        // Active Fee Heads
        const feeHeads = await prisma.feeHead.findMany({
            where: {
                schoolId: req.user.schoolId,
                isActive: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        // Find Fee Structure
        let feeStructure = await prisma.feeStructure.findFirst({
            where: {
                schoolId: req.user.schoolId,
                sessionId,
                classId,
            },
            include: {
                items: {
                    include: {
                        feeHead: true,
                    },
                },
            },
        });

        // Create Fee Structure if not exists
        if (!feeStructure) {
            feeStructure = await prisma.feeStructure.create({
                data: {
                    schoolId: req.user.schoolId,
                    sessionId,
                    classId,
                    name: "Default Fee Structure",
                    status: true,
                },
            });

            // Create Items for all active Fee Heads
            if (feeHeads.length) {
                await prisma.feeStructureItem.createMany({
                    data: feeHeads.map((head) => ({
                        feeStructureId: feeStructure.id,
                        feeHeadId: head.id,
                        amount: 0,
                        concession: 0,
                        applyTo: "All Students",
                        remark: "",
                    })),
                });
            }
        } else {
            // Existing Fee Head IDs
            const existingHeadIds = feeStructure.items.map(
                (item) => item.feeHeadId
            );

            // Find new active Fee Heads
            const newHeads = feeHeads.filter(
                (head) => !existingHeadIds.includes(head.id)
            );

            // Create missing items only
            if (newHeads.length) {
                await prisma.feeStructureItem.createMany({
                    data: newHeads.map((head) => ({
                        feeStructureId: feeStructure.id,
                        feeHeadId: head.id,
                        amount: 0,
                        concession: 0,
                        applyTo: "All Students",
                        remark: "",
                    })),
                });
            }
        }

        // Reload with ONLY active Fee Heads
        const itemInclude = {
            feeHead: true,
        };

        if (studentId) {
            itemInclude.studentOverrides = {
                where: {
                    studentId,
                },
            };
        }

        feeStructure = await prisma.feeStructure.findUnique({
            where: {
                id: feeStructure.id,
            },
            include: {
                items: {
                    where: {
                        feeHead: {
                            isActive: true,
                        },
                    },
                    include: itemInclude,
                    orderBy: {
                        createdAt: "asc",
                    },
                },
            },
        });

        if (studentId && feeStructure?.items) {
            feeStructure.items = feeStructure.items.map((item) => {
                const override = item.studentOverrides?.[0];

                if (!override) {
                    return item;
                }

                return {
                    ...item,
                    amount: override.amount,
                    concession: override.concession,
                    applyTo: override.applyTo,
                    remark: override.remark || item.remark,
                    studentFeeOverrideId: override.id,
                };
            });
        }

        return res.status(200).json({
            success: true,
            exists: true,
            data: feeStructure,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.saveFeeStructure = async (req, res) => {
    try {
        const { sessionId, classId, name, fees } = req.body;

        if (!sessionId || !classId) {
            return res.status(400).json({
                success: false,
                message: "Session and Class are required."
            });
        }

        if (!Array.isArray(fees) || fees.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Fee items are required."
            });
        }

        const schoolId = req.user.schoolId;

        // Check Session
        const session = await prisma.academicSession.findFirst({
            where: {
                id: sessionId,
                schoolId
            }
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Academic session not found."
            });
        }

        // Check Class
        const classData = await prisma.class.findFirst({
            where: {
                id: classId,
                schoolId
            }
        });

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found."
            });
        }

        // Check existing Fee Structure
        let feeStructure = await prisma.feeStructure.findFirst({
            where: {
                schoolId,
                sessionId,
                classId
            }
        });

        // Create Header
        if (!feeStructure) {
            feeStructure = await prisma.feeStructure.create({
                data: {
                    schoolId,
                    sessionId,
                    classId,
                    name: name || `${classData.sortName} Fee Structure`,
                    status: true
                }
            });
        }

        // Remove old items
        await prisma.feeStructureItem.deleteMany({
            where: {
                feeStructureId: feeStructure.id
            }
        });

        // Insert new items
        await prisma.feeStructureItem.createMany({
            data: fees.map(item => ({
                feeStructureId: feeStructure.id,
                feeHeadId: item.feeHeadId,
                applyTo: item.applyTo,
                amount: Number(item.amount),
                concession: Number(item.concession),
                remark: item.remark || ""
            }))
        });

        const result = await prisma.feeStructure.findUnique({
            where: {
                id: feeStructure.id
            },
            include: {
                items: {
                    include: {
                        feeHead: true
                    }
                },
                class: true,
                session: true
            }
        });

        return res.status(200).json({
            success: true,
            message: "Fee Structure saved successfully.",
            data: result
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.saveStudentFeeOverride = async (req, res) => {
    try {

        const { studentId, fees } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student is required."
            });
        }

        if (!fees || !fees.length) {
            return res.status(400).json({
                success: false,
                message: "Fees are required."
            });
        }

        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                schoolId: req.user.schoolId
            }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        await prisma.studentFeeOverride.deleteMany({
            where: {
                studentId
            }
        });

        await prisma.studentFeeOverride.createMany({
            data: fees.map(item => ({
                studentId,
                feeStructureItemId: item.feeStructureItemId,
                amount: Number(item.amount),
                concession: Number(item.concession || 0),
                applyTo: item.applyTo,
                remark: item.remark || ""
            }))
        });

        return res.status(200).json({
            success: true,
            message: "Student fee updated successfully."
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

