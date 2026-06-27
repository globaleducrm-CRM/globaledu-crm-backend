const {PrismaClient} = require('@prisma/client');
const { json } = require('express');


const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {

        const sessions = await prisma.academicSession.findMany({
            where: {
                schoolId: req.user.schoolId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Academic sessions fetched successfully.",
            data: sessions,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

exports.store = async (req, res) => {
    try {
        const { sessionName, startDate, endDate } = req.body;

        // Validation
        if (!sessionName || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

       
        // Only School Admin
        if (req.user.role?.name !== "SCHOOL_ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Only School Admin can create Academic Session."
            });
        }

        // Duplicate session
        const existingSession = await prisma.academicSession.findFirst({
            where: {
                schoolId: req.user.schoolId,
                sessionName
            }
        });

        if (existingSession) {
            return res.status(400).json({
                success: false,
                message: "Session already exists."
            });
        }

        const session = await prisma.academicSession.create({
            data: {
                schoolId: req.user.schoolId,
                sessionName,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isCurrent: false
            }
        });

        return res.status(201).json({
            success: true,
            message: "Academic Session created successfully.",
            data: session
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};


exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { sessionName, startDate, endDate, isCurrent } = req.body;

        // Validation
        if (!sessionName || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });
        }

        // Check session exists
        const session = await prisma.academicSession.findUnique({
            where: { id },
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Academic Session not found.",
            });
        }

        // Duplicate check
        const duplicate = await prisma.academicSession.findFirst({
            where: {
                schoolId: req.user.schoolId,
                sessionName,
                NOT: {
                    id,
                },
            },
        });

        if (duplicate) {
            return res.status(400).json({
                success: false,
                message: "Session name already exists.",
            });
        }

        // Update
        const updatedSession = await prisma.academicSession.update({
            where: { id },
            data: {
                sessionName,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isCurrent,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Academic Session updated successfully.",
            data: updatedSession,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.status = async (req, res) => {
    try {

        const { id } = req.params;

        // Check session
        const session = await prisma.academicSession.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId
            }
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Academic Session not found."
            });
        }

        // Remove current status from all sessions
        await prisma.academicSession.updateMany({
            where: {
                schoolId: req.user.schoolId
            },
            data: {
                isCurrent: false
            }
        });

        // Set selected session as current
        const updatedSession = await prisma.academicSession.update({
            where: {
                id
            },
            data: {
                isCurrent: true
            }
        });

        return res.status(200).json({
            success: true,
            message: "Current session updated successfully.",
            data: updatedSession
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.delete = async (req, res) => {
    try {

        const { id } = req.params;

        const session = await prisma.academicSession.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId
            }
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Academic Session not found."
            });
        }

        // Current session delete na hone do
        if (session.isCurrent) {
            return res.status(400).json({
                success: false,
                message: "Current Academic Session cannot be deleted."
            });
        }

        await prisma.academicSession.delete({
            where: {
                id
            }
        });

        return res.status(200).json({
            success: true,
            message: "Academic Session deleted successfully."
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};