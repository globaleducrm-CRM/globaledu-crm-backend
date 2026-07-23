const { PrismaClient } = require('@prisma/client');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const prisma = new PrismaClient();


exports.index = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { page, limit, skip } = getPagination(req);

        const [feeHeads, total] = await Promise.all([
            prisma.feeHead.findMany({
                where: {
                    schoolId,
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
            }),

            prisma.feeHead.count({
                where: {
                    schoolId,
                },
            }),
        ]);

        return res.status(200).json({
            success: true,
            message: "Fee Heads fetched successfully.",
            data: feeHeads,
            pagination: getPaginationMeta(page, limit, total)
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.store = async (req, res) => {
    try {
        const {
            feeHeadName,
            frequency,
            description,
            taxable,
            isActive,
        } = req.body

        const schoolId = req.user.schoolId;

        // Validation
        if (!feeHeadName || !frequency) {
            return res.status(400).json({
                success: false,
                message: "Fee Head Name and Frequency are required.",
            });
        }

        // Check Duplicate
        const existingFeeHead = await prisma.feeHead.findFirst({
            where: {
                schoolId,
                feeHeadName: feeHeadName.trim(),
            },
        });

        if (existingFeeHead) {
            return res.status(409).json({
                success: false,
                message: "Fee Head already exists.",
            });
        }

        // Create Fee Head
        const feeHead = await prisma.feeHead.create({
            data: {
                schoolId: schoolId,
                feeHeadName: feeHeadName.trim(),
                frequency,
                description,
                taxable,
                isActive,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Fee Head created successfully.",
            data: feeHead,
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


exports.edit = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const { id } = req.params;

        const {
            feeHeadName,
            frequency,
            description,
            isActive,
            taxable
        } = req.body;

        // Validation
        if (!feeHeadName || !frequency) {
            return res.status(400).json({
                success: false,
                message: "Fee Head Name and Frequency are required."
            });
        }

        // Check Fee Head Exists
        const existingFeeHead = await prisma.feeHead.findFirst({
            where: {
                id,
                schoolId
            }
        });

        if (!existingFeeHead) {
            return res.status(404).json({
                success: false,
                message: "Fee Head not found."
            });
        }

        // Duplicate Check
        const duplicate = await prisma.feeHead.findFirst({
            where: {
                schoolId,
                feeHeadName: feeHeadName.trim(),
                NOT: {
                    id
                }
            }
        });

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Fee Head already exists."
            });
        }

        // Update
        const updatedFeeHead = await prisma.feeHead.update({
            where: {
                id
            },
            data: {
                feeHeadName: feeHeadName.trim(),
                frequency,
                description,
                isActive,
                taxable
            }
        });

        return res.status(200).json({
            success: true,
            message: "Fee Head updated successfully.",
            data: updatedFeeHead
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

        const existFeeHead = await prisma.feeHead.findUnique({
            where: {
                id: id
            }
        })

        if (!existFeeHead) {
            return res.status(400).json({
                success: false,
                message: "Fees Head not Found"
            })
        }

        await prisma.feeHead.delete({
            where: {
                id
            }
        });

        return res.status(200).json({
            success: true,
            message: "Fees Head delete successfully"
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


