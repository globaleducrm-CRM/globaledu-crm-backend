const { PrismaClient } = require("@prisma/client");
const fs = require('fs');
const path = require('path');
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const emailTemplate = require("../../utils/emailTemplate");
const { sendParentWelcomeEmail, sendStudentWelcomeEmail } = require("../../utils/emailHelpers");



const prisma = new PrismaClient();


exports.generateAdmissionNo = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;

        // School Details
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: {
                schoolCode: true,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found.",
            });
        }

        // Current Session
        const currentSession = await prisma.academicSession.findFirst({
            where: {
                schoolId,
                isCurrent: true,
            },
        });

        if (!currentSession) {
            return res.status(404).json({
                success: false,
                message: "Current academic session not found.",
            });
        }

        const year = currentSession.startDate.getFullYear();

        // Get all admission numbers of this school
        const students = await prisma.student.findMany({
            where: {
                schoolId,
            },
            select: {
                admissionNo: true,
            },
        });

        let maxSerial = 0;

        students.forEach((student) => {
            if (!student.admissionNo) return;

            const parts = student.admissionNo.split("-");

            if (parts.length === 3) {
                const serial = parseInt(parts[2], 10);

                if (!isNaN(serial) && serial > maxSerial) {
                    maxSerial = serial;
                }
            }
        });

        const nextSerial = maxSerial + 1;

        const admissionNo = `${school.schoolCode}-${year}-${String(nextSerial).padStart(6, "0")}`;

        return res.status(200).json({
            success: true,
            message: "Admission number generated successfully.",
            data: {
                admissionNo,
            },
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// student.controller.js
exports.store = async (req, res) => {
    let createdStudent = null;
    let createdStudentUser = null;
    let createdParents = [];
    let createdParentUsers = [];

    try {
        let {
            classId,
            sectionId,
            admissionNo,
            rollNo,
            admissionDate,
            firstName,
            middleName,
            lastName,
            gender,
            dob,
            bloodGroup,
            studentEmail,
            mobile,

            fatherName,
            fatherMobile,
            fatherEmail,
            motherName,
            motherMobile,
            motherEmail,
            address,
            city,
            nationality,
        } = req.body;

        // Validate required fields
        if (!classId || !sectionId || !admissionNo || !firstName || !gender || !dob ||
            !fatherName || !fatherMobile || !motherName || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: req.user.schoolId }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        // Check if school is approved
        if (school.status !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "School is not approved. Please contact super admin."
            });
        }

        // Get STUDENT and PARENT roles
        const [studentRole, parentRole] = await Promise.all([
            prisma.role.findUnique({
                where: { name: "STUDENT" }
            }),
            prisma.role.findUnique({
                where: { name: "PARENT" }
            })
        ]);

        if (!studentRole || !parentRole) {
            return res.status(404).json({
                success: false,
                message: "Student or Parent role not found."
            });
        }

        // Check for duplicate admission number
        const existingStudent = await prisma.student.findFirst({
            where: {
                schoolId: req.user.schoolId,
                admissionNo: admissionNo
            }
        });

        if (existingStudent) {
            return res.status(409).json({
                success: false,
                message: `Student with admission number ${admissionNo} already exists.`
            });
        }

        // Check if student email already exists
        if (studentEmail) {
            const existingUser = await prisma.user.findUnique({
                where: { email: studentEmail }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Student email already exists in user system."
                });
            }
        }

        // Check if student mobile already exists
        if (mobile) {
            const existingUser = await prisma.user.findFirst({
                where: { mobile: mobile }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Student mobile number already exists in user system."
                });
            }
        }

        // Check if parent emails already exist
        const parentEmails = [];
        if (fatherEmail) parentEmails.push(fatherEmail);
        if (motherEmail) parentEmails.push(motherEmail);

        if (parentEmails.length > 0) {
            const existingUsers = await prisma.user.findMany({
                where: {
                    email: { in: parentEmails }
                }
            });
            if (existingUsers.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Email(s) already exist: ${existingUsers.map(u => u.email).join(', ')}`
                });
            }
        }

        // Check if parent mobiles already exist
        const parentMobiles = [];
        if (fatherMobile) parentMobiles.push({ mobile: fatherMobile, name: fatherName, role: 'Father' });
        if (motherMobile) parentMobiles.push({ mobile: motherMobile, name: motherName, role: 'Mother' });

        if (parentMobiles.length > 0) {
            const existingUsers = await prisma.user.findMany({
                where: {
                    mobile: { in: parentMobiles.map(p => p.mobile) }
                }
            });
            if (existingUsers.length > 0) {
                const duplicateDetails = existingUsers.map(user => {
                    const parentInfo = parentMobiles.find(p => p.mobile === user.mobile);
                    return `${parentInfo?.role} ${parentInfo?.name} (${user.mobile})`;
                }).join(', ');

                return res.status(409).json({
                    success: false,
                    message: `Mobile number(s) already exist: ${duplicateDetails}`,
                    suggestion: "Please ensure you're using unique mobile numbers for each parent. Contact school admin if you need to reuse existing parent accounts."
                });
            }
        }

        // Get current academic session
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

        // Generate Password function
        const generatePassword = () => {
            return crypto
                .randomBytes(8)
                .toString("base64")
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 10);
        };

        // Create Student User
        let studentUser = null;
        let studentPassword = null;

        if (studentEmail) {
            studentPassword = generatePassword();

            console.log("Generated student studentEmail:", studentEmail);
            console.log("Generated student password:", studentPassword);
            const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);

            studentUser = await prisma.user.create({
                data: {
                    schoolId: req.user.schoolId,
                    roleId: studentRole.id,
                    name: `${firstName} ${lastName || ''}`.trim(),
                    email: studentEmail,
                    mobile: mobile,
                    password: hashedStudentPassword,
                    isActive: true
                }
            });
            createdStudentUser = studentUser;
        }

        // Create Student FIRST
        const student = await prisma.student.create({
            data: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                userId: studentUser?.id || null,
                classId: classId,
                sectionId: sectionId,
                admissionNo: admissionNo,
                rollNo: rollNo ? parseInt(rollNo) : null,
                admissionDate: new Date(admissionDate),
                firstName: firstName,
                middleName: middleName || null,
                lastName: lastName || null,
                email: studentEmail || null,
                mobile: mobile || null,
                gender: gender,
                dob: dob ? new Date(dob) : null,
                bloodGroup: bloodGroup || null,
                nationality: nationality || "India",
            }
        });
        createdStudent = student;

        // Create Parent Users and Parents
        const parentCredentials = [];
        let createdFather = null;
        let createdMother = null;

        // Create Father
        if (fatherEmail) {
            try {
                // Check if father mobile already exists before creating
                if (fatherMobile) {
                    const existingFatherUser = await prisma.user.findFirst({
                        where: { mobile: fatherMobile }
                    });
                    if (existingFatherUser) {
                        return res.status(409).json({
                            success: false,
                            message: `Father's mobile number ${fatherMobile} already exists in user system.`
                        });
                    }
                }

                const fatherPassword = generatePassword();

                console.log("Generated father fatherEmail:", fatherEmail);
                console.log("Generated father password:", fatherPassword);
                const hashedFatherPassword = await bcrypt.hash(fatherPassword, 10);

                const fatherUser = await prisma.user.create({
                    data: {
                        schoolId: req.user.schoolId,
                        roleId: parentRole.id,
                        name: fatherName,
                        email: fatherEmail,
                        mobile: fatherMobile,
                        password: hashedFatherPassword,
                        isActive: true
                    }
                });
                createdParentUsers.push(fatherUser);

                // Create Parent record WITH studentId
                createdFather = await prisma.parent.create({
                    data: {
                        schoolId: req.user.schoolId,
                        userId: fatherUser.id,

                        fatherName: fatherName,
                        fatherMobile: fatherMobile,
                        fatherEmail: fatherEmail,
                        motherName: motherName || null,
                        motherMobile: motherMobile || null,
                        motherEmail: motherEmail || null,
                        address: address || null,
                        city: city || null,
                    }
                });
                createdParents.push(createdFather);

                parentCredentials.push({
                    name: fatherName,
                    email: fatherEmail,
                    password: fatherPassword,
                    relationship: "Father"
                });
            } catch (error) {
                console.error("Error creating father:", error);
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0] || 'field';
                    return res.status(409).json({
                        success: false,
                        message: `Father's ${field} already exists in the system.`
                    });
                }
                await cleanupCreatedData(createdStudent, createdStudentUser);
                throw new Error(`Failed to create father account: ${error.message}`);
            }
        }

        // Create Mother
        if (motherEmail) {
            try {
                // Check if mother mobile already exists before creating
                if (motherMobile) {
                    const existingMotherUser = await prisma.user.findFirst({
                        where: { mobile: motherMobile }
                    });
                    if (existingMotherUser) {
                        return res.status(409).json({
                            success: false,
                            message: `Mother's mobile number ${motherMobile} already exists in user system.`
                        });
                    }
                }

                const motherPassword = generatePassword();
                const hashedMotherPassword = await bcrypt.hash(motherPassword, 10);

                const motherUser = await prisma.user.create({
                    data: {
                        schoolId: req.user.schoolId,
                        roleId: parentRole.id,
                        name: motherName,
                        email: motherEmail,
                        mobile: motherMobile,
                        password: hashedMotherPassword,
                        isActive: true
                    }
                });
                createdParentUsers.push(motherUser);

                // Create Parent record WITH studentId
                createdMother = await prisma.parent.create({
                    data: {
                        schoolId: req.user.schoolId,
                        userId: motherUser.id,
                        studentId: student.id, // 🔥 FIX: Add studentId here
                        fatherName: fatherName || null,
                        fatherMobile: fatherMobile || null,
                        fatherEmail: fatherEmail || null,
                        motherName: motherName,
                        motherMobile: motherMobile,
                        motherEmail: motherEmail,
                        address: address || null,
                        city: city || null,
                    }
                });
                createdParents.push(createdMother);

                parentCredentials.push({
                    name: motherName,
                    email: motherEmail,
                    password: motherPassword,
                    relationship: "Mother"
                });
            } catch (error) {
                console.error("Error creating mother:", error);
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0] || 'field';
                    return res.status(409).json({
                        success: false,
                        message: `Mother's ${field} already exists in the system.`
                    });
                }
                await cleanupCreatedData(createdStudent, createdStudentUser, createdParents, createdParentUsers);
                throw new Error(`Failed to create mother account: ${error.message}`);
            }
        }

        // Update student with parentId
        let updatedStudent = null;
        if (createdFather) {
            updatedStudent = await prisma.student.update({
                where: { id: student.id },
                data: {
                    parentId: createdFather.id
                },
                include: {
                    user: true,
                    class: true,
                    section: true,
                    session: true
                }
            });
            createdStudent = updatedStudent;
        } else if (createdMother) {
            updatedStudent = await prisma.student.update({
                where: { id: student.id },
                data: {
                    parentId: createdMother.id
                },
                include: {
                    user: true,
                    class: true,
                    section: true,
                    session: true
                }
            });
            createdStudent = updatedStudent;
        }

        // Send Emails
        const emailResults = [];

        // Send Student Email
        if (studentUser && studentPassword) {
            try {
                await sendStudentWelcomeEmail(
                    `${firstName} ${lastName || ''}`,
                    studentUser.email,
                    studentPassword,
                    admissionNo,
                    fatherName,
                    motherName,
                    school.name
                );
                emailResults.push({
                    email: studentUser.email,
                    type: 'student',
                    status: 'sent'
                });
            } catch (error) {
                console.error('Failed to send student email:', error);
                emailResults.push({
                    email: studentUser.email,
                    type: 'student',
                    status: 'failed',
                    error: error.message
                });
            }
        }

        // Send Parent Emails
        for (const parent of parentCredentials) {
            try {
                await sendParentWelcomeEmail(
                    parent.name,
                    parent.email,
                    parent.password,
                    parent.relationship,
                    `${firstName} ${lastName || ''}`,
                    admissionNo,
                    school.name
                );
                emailResults.push({
                    email: parent.email,
                    type: 'parent',
                    status: 'sent',
                    relationship: parent.relationship
                });
            } catch (error) {
                console.error(`Failed to send email to ${parent.email}:`, error);
                emailResults.push({
                    email: parent.email,
                    type: 'parent',
                    status: 'failed',
                    relationship: parent.relationship,
                    error: error.message
                });
            }
        }

        // Prepare response
        const studentResponse = {
            ...createdStudent,
            user: studentUser ? {
                id: studentUser.id,
                email: studentUser.email,
                name: studentUser.name
            } : null
        };

        // Remove sensitive data
        if (studentResponse.user) {
            delete studentResponse.user.password;
        }

        return res.status(201).json({
            success: true,
            message: emailResults.some(e => e.status === 'sent')
                ? 'Student and parent accounts created successfully. Login credentials sent to email(s).'
                : 'Student and parent accounts created successfully but some emails could not be sent. Please contact admin.',
            data: {
                student: studentResponse,
                parents: createdParents.map(p => ({
                    id: p.id,
                    fatherName: p.fatherName,
                    fatherMobile: p.fatherMobile,
                    fatherEmail: p.fatherEmail,
                    motherName: p.motherName,
                    motherMobile: p.motherMobile,
                    motherEmail: p.motherEmail,
                    address: p.address,
                    city: p.city
                })),
                emailResults: emailResults
            }
        });

    } catch (error) {
        console.error("❌ Store Student Error:", error);
        console.error("❌ Error stack:", error.stack);

        // Cleanup created data on error
        await cleanupCreatedData(createdStudent, createdStudentUser, createdParents, createdParentUsers);

        // Handle Prisma unique constraint errors
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `Duplicate entry for ${field}. Please check and try again.`
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

// Cleanup function to delete created data on error
async function cleanupCreatedData(student, studentUser, parents = [], parentUsers = []) {
    try {
        // Delete parents first (in reverse order)
        for (const parent of parents) {
            try {
                await prisma.parent.delete({
                    where: { id: parent.id }
                });
                console.log(`✅ Deleted parent: ${parent.id}`);
            } catch (e) {
                console.error(`Error deleting parent ${parent.id}:`, e);
            }
        }

        // Delete parent users
        for (const parentUser of parentUsers) {
            try {
                await prisma.user.delete({
                    where: { id: parentUser.id }
                });
                console.log(`✅ Deleted parent user: ${parentUser.id}`);
            } catch (e) {
                console.error(`Error deleting parent user ${parentUser.id}:`, e);
            }
        }

        // Delete student
        if (student) {
            try {
                await prisma.student.delete({
                    where: { id: student.id }
                });
                console.log(`✅ Deleted student: ${student.id}`);
            } catch (e) {
                console.error(`Error deleting student ${student.id}:`, e);
            }
        }

        // Delete student user
        if (studentUser) {
            try {
                await prisma.user.delete({
                    where: { id: studentUser.id }
                });
                console.log(`✅ Deleted student user: ${studentUser.id}`);
            } catch (e) {
                console.error(`Error deleting student user ${studentUser.id}:`, e);
            }
        }

        console.log("✅ Cleanup completed successfully");
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    }
}


exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = req.query.search?.trim() || "";
        const { classId, sectionId, sessionId, promotionResult } = req.query;

        // Get current session
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

        // Get all students who already have TC issued (using correct model name)
        const transferStudents = await prisma.transferCertificate.findMany({
            where: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                status: "ISSUED",
            },
            select: {
                studentId: true,
            },
        });

        const issuedStudentIds = transferStudents.map(tc => tc.studentId);

        // Build where clause
        const whereClause = {
            schoolId: req.user.schoolId,
            sessionId: currentSession.id,
        };

        // Exclude students who already have TC issued
        if (issuedStudentIds.length > 0) {
            whereClause.id = {
                notIn: issuedStudentIds,
            };
        }

        // Apply filters
        if (classId) {
            whereClause.classId = classId;
        }

        if (sectionId) {
            whereClause.sectionId = sectionId;
        }

        if (promotionResult) {
            whereClause.promotionResult = promotionResult;
        }

        if (sessionId) {
            whereClause.sessionId = sessionId;
        }

        // Search filter
        if (search) {
            whereClause.OR = [
                {
                    firstName: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    lastName: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    admissionNo: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        // Fetch students with pagination
        const [students, total] = await Promise.all([
            prisma.student.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            mobile: true,
                        },
                    },
                    class: {
                        select: {
                            id: true,
                            className: true,
                            sortName: true,
                        },
                    },
                    section: {
                        select: {
                            id: true,
                            sectionName: true,
                        },
                    },
                    session: {
                        select: {
                            id: true,
                            sessionName: true,
                        },
                    },
                    parent: {
                        select: {
                            id: true,
                            fatherName: true,
                            fatherMobile: true,
                            fatherEmail: true,
                            motherName: true,
                            motherMobile: true,
                            motherEmail: true,
                            city: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),

            prisma.student.count({
                where: whereClause,
            }),
        ]);

        // Format students data
        const formattedStudents = students.map(student => ({
            ...student,
            dob: student.dob
                ? student.dob.toISOString().split("T")[0]
                : null,
            admissionDate: student.admissionDate
                ? student.admissionDate.toISOString().split("T")[0]
                : null,
            fullName: `${student.firstName || ''} ${student.middleName || ''} ${student.lastName || ''}`.trim(),
            // Add TC status
            tcStatus: 'NOT_ISSUED',
        }));

        return res.status(200).json({
            success: true,
            session: {
                id: currentSession.id,
                sessionName: currentSession.sessionName,
            },
            data: formattedStudents,
            pagination: getPaginationMeta(page, limit, total),
            filters: {
                classId: classId || null,
                sectionId: sectionId || null,
                sessionId: sessionId || null,
                promotionResult: promotionResult || null,
                search: search || null,
            },
            summary: {
                total: total,
                issued: issuedStudentIds.length,
                available: total,
            },
        });

    } catch (error) {
        console.error("Error in index:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error",
            error: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
    }
};


exports.studentHistory = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);

        const {
            sessionId,
            classId,
            sectionId,
            promotionResult,
            search,
        } = req.query;

        const where = {
            schoolId: req.user.schoolId,
        };

        if (sessionId) where.sessionId = sessionId;
        if (classId) where.classId = classId;
        if (sectionId) where.sectionId = sectionId;
        if (promotionResult) where.promotionResult = promotionResult;

        if (search) {
            where.student = {
                OR: [
                    {
                        firstName: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        lastName: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        admissionNo: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                ],
            };
        }

        const total = await prisma.studentEnrollment.count({
            where,
        });

        const data = await prisma.studentEnrollment.findMany({
            where,
            skip,
            take: limit,
            include: {
                session: {
                    select: {
                        id: true,
                        sessionName: true,
                    },
                },
                class: {
                    select: {
                        id: true,
                        className: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        admissionNo: true,
                        firstName: true,
                        lastName: true,
                        image: true,
                        mobile: true,
                        email: true,
                        status:true,

                        parent: {
                            select: {
                                id: true,
                                fatherName: true,
                                fatherMobile: true,
                                fatherEmail: true,
                                motherName: true,
                                motherMobile: true,
                                motherEmail: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                promotedAt: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            data,
            pagination: getPaginationMeta(page, limit, total),
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.studentEnrollmentHistory = async (req, res) => {
    try {
        const { studentId } = req.params;

        const enrollments = await prisma.studentEnrollment.findMany({
            where: {
                studentId,
                schoolId: req.user.schoolId
            },
            include: {
                session: {
                    select: {
                        id: true,
                        sessionName: true
                    }
                },
                class: {
                    select: {
                        id: true,
                        className: true
                    }
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true
                    }
                }
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        return res.status(200).json({
            success: true,
            message: "Student enrollment history fetched successfully.",
            data: enrollments
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.show = async (req, res) => {
    try {
        const studentId = req.params.id;

        const student = await prisma.student.findUnique({
            where: {
                id: studentId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
                        isActive: true
                    },

                },
                class: {
                    select: {
                        id: true,
                        className: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        sessionName: true,
                    },
                },
                parent: {
                    select: {
                        id: true,
                        fatherName: true,
                        fatherMobile: true,
                        fatherEmail: true,
                        motherName: true,
                        motherMobile: true,
                        motherEmail: true,
                        status: true
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Student retrieved successfully.",
            data: student,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving the student.",
        });
    }
};



exports.update = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            // Tab identifier
            updateTab,

            // Basic Fields
            classId,
            sectionId,
            admissionNo,
            rollNo,
            admissionDate,
            firstName,
            middleName,
            lastName,
            email,
            mobile,
            gender,
            dob,
            bloodGroup,
            nationality,
            religion,
            caste,
            category,
            previousSchool,
            medicalHistory,

            // Address Fields
            address,
            city,
            state,
            pincode,
            country,

            // Physical Fields
            height,
            weight,

            // Hostel
            hostel,

            // Parent Fields
            fatherName,
            fatherMobile,
            fatherEmail,
            motherName,
            motherMobile,
            motherEmail,
            fatherOccupation,
            motherOccupation,
            fatherAadhaar,
            motherAadhaar,
            annualIncome,
            officeAddress,



            // Session
            sessionId
        } = req.body;



        // ============================================
        // 1. VALIDATION
        // ============================================

        const validationErrors = {};

        // Check if student exists
        const existingStudent = await prisma.student.findUnique({
            where: { id },
            include: {
                parent: true,
                transportInfo: true
            }
        });

        if (!existingStudent) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Basic tab validations
        if (updateTab === 'basic' || !updateTab) {
            if (!firstName || firstName.trim() === '') {
                validationErrors.firstName = 'First name is required';
            }
            if (!lastName || lastName.trim() === '') {
                validationErrors.lastName = 'Last name is required';
            }
            if (!admissionNo || admissionNo.trim() === '') {
                validationErrors.admissionNo = 'Admission number is required';
            }
            if (!email || email.trim() === '') {
                validationErrors.email = 'Email is required';
            } else if (!isValidEmail(email)) {
                validationErrors.email = 'Invalid email format';
            }
            if (!dob) {
                validationErrors.dob = 'Date of birth is required';
            }


            // Check for duplicate admission number
            if (admissionNo) {
                const duplicateAdmission = await prisma.student.findFirst({
                    where: {
                        admissionNo,
                        schoolId: existingStudent.schoolId,
                        id: { not: id }
                    }
                });
                if (duplicateAdmission) {
                    validationErrors.admissionNo = 'Admission number already exists';
                }
            }

            // Check for duplicate email
            if (email) {
                const duplicateEmail = await prisma.student.findFirst({
                    where: {
                        email: email,
                        schoolId: existingStudent.schoolId,
                        id: { not: id }
                    }
                });
                if (duplicateEmail) {
                    validationErrors.email = 'Email already exists';
                }
            }
        }

        // Parent tab validations
        if (updateTab === 'parents') {
            if (!fatherName || fatherName.trim() === '') {
                validationErrors.fatherName = 'Father name is required';
            }
            if (!fatherMobile || fatherMobile.trim() === '') {
                validationErrors.fatherMobile = 'Father mobile is required';
            } else if (!isValidPhone(fatherMobile)) {
                validationErrors.fatherMobile = 'Invalid mobile number';
            }
            if (!fatherEmail || fatherEmail.trim() === '') {
                validationErrors.fatherEmail = 'Father email is required';
            } else if (!isValidEmail(fatherEmail)) {
                validationErrors.fatherEmail = 'Invalid email format';
            }
        }

        if (Object.keys(validationErrors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        // ============================================
        // 2. HANDLE IMAGE UPLOAD
        // ============================================

        let imagePath = null;

        // Check if image is being uploaded via file
        if (req.file) {
            imagePath = req.file.path;

            // Delete old image if exists
            if (existingStudent.image) {
                const oldImagePath = path.join(__dirname, '..', existingStudent.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }
        // Check if image is being removed (frontend sends 'null')
        else if (req.body.image === 'null' || req.body.image === '') {
            // Delete existing image
            if (existingStudent.image) {
                const oldImagePath = path.join(__dirname, '..', existingStudent.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            imagePath = null;
        }

        // ============================================
        // 3. BUILD UPDATE DATA BASED ON TAB
        // ============================================

        let studentUpdateData = {};
        let parentUpdateData = {};


        // Basic Tab Update
        if (updateTab === 'basic' || !updateTab) {
            studentUpdateData = {

                
                sessionId: sessionId || existingStudent.sessionId,
                admissionNo: admissionNo?.trim(),
                rollNo: rollNo ? Number(rollNo) : null,
                admissionDate: admissionDate ? new Date(admissionDate) : existingStudent.admissionDate,
                firstName: firstName?.trim(),
                middleName: middleName?.trim() || null,
                lastName: lastName?.trim(),
                email: email?.trim(),
                mobile: mobile?.trim() || null,
                gender: gender || null,
                dob: dob ? new Date(dob) : null,
                bloodGroup: bloodGroup || null,
                nationality: nationality || 'India',
                religion: religion || null,
                caste: caste || null,
                category: category || null,
                previousSchool: previousSchool || null,
                medicalHistory: medicalHistory || null,
            };

            // Add image only if it was uploaded or removed
            if (req.file || req.body.image === 'null' || req.body.image === '') {
                studentUpdateData.image = imagePath;
            }
        }

        // Address Tab Update
        if (updateTab === 'address') {
            studentUpdateData = {
                address: address || null,
                city: city || null,
                state: state || null,
                pincode: pincode || null,
                country: country || null,
            };
        }

        // Physical Tab Update
        if (updateTab === 'physical') {
            studentUpdateData = {
                height: height ? parseFloat(height) : null,
                weight: weight ? parseFloat(weight) : null,
                bloodGroup: bloodGroup || null,
                medicalHistory: medicalHistory || null,
            };
        }

        // Medical Tab Update
        if (updateTab === 'medical') {
            studentUpdateData = {
                bloodGroup: bloodGroup || null,
                medicalHistory: medicalHistory || null,
            };
        }

        // Misc Tab Update
        if (updateTab === 'misc') {
            studentUpdateData = {
                previousSchool: previousSchool || null,
                category: category || null,
                hostel: typeof hostel === 'boolean' ? hostel : false,
            };
        }

        // Class Tab Update
        if (updateTab === 'class') {

            if (!classId) {
                validationErrors.classId = 'Class is required';
            }
            if (!sessionId) {
                validationErrors.sessionId = 'Session is required';
            }
            studentUpdateData = {
                classId: classId || null,
                sectionId: sectionId || null,
                admissionDate: admissionDate ? new Date(admissionDate) : existingStudent.admissionDate,
                sessionId: sessionId || existingStudent.sessionId,
            };
        }

        // Parent Tab Update
        if (updateTab === 'parents') {
            parentUpdateData = {
                fatherName: fatherName?.trim(),
                fatherMobile: fatherMobile?.trim(),
                fatherEmail: fatherEmail?.trim(),
                motherName: motherName?.trim() || null,
                motherMobile: motherMobile?.trim() || null,
                motherEmail: motherEmail?.trim() || null,
                fatherOccupation: fatherOccupation || null,
                motherOccupation: motherOccupation || null,
                fatherAadhaar: fatherAadhaar || null,
                motherAadhaar: motherAadhaar || null,
                annualIncome: annualIncome ? parseFloat(annualIncome) : null,
                officeAddress: officeAddress || null,
            };
        }

        // Transport Tab Update
        let transportUpdateData = {};

        if (updateTab === 'transport') {
            // Check if we have any transport data
            const hasTransportData = req.body.transportRequired !== undefined ||
                req.body.pickupPoint ||
                req.body.pickupTime ||
                req.body.dropTime ||
                req.body.conductorName ||
                req.body.conductorPhone;

            if (hasTransportData) {
                transportUpdateData = {
                    transportRequired: req.body.transportRequired === "true",
                    pickupPoint: req.body.pickupPoint || null,
                    pickupTime: req.body.pickupTime || null,
                    dropTime: req.body.dropTime || null,
                    conductorName: req.body.conductorName || null,
                    conductorPhone: req.body.conductorPhone || null
                };
            }
        }

        // ============================================
        // 4. UPDATE STUDENT
        // ============================================

        if (Object.keys(studentUpdateData).length > 0) {
            await prisma.student.update({
                where: { id },
                data: studentUpdateData
            });

            // Update student user only if basic tab
            if (updateTab === 'basic' && existingStudent.userId) {
                await prisma.user.update({
                    where: { id: existingStudent.userId },
                    data: {
                        name: `${firstName?.trim() || ''} ${lastName?.trim() || ''}`.trim(),
                        email: email?.trim(),
                        mobile: mobile?.trim() || null
                    }
                });
            }
        }

        // ============================================
        // 5. UPDATE PARENT
        // ============================================

        if (Object.keys(parentUpdateData).length > 0) {
            if (existingStudent.parentId) {
                const updatedParent = await prisma.parent.update({
                    where: { id: existingStudent.parentId },
                    data: parentUpdateData
                });

                // Update parent user
                if (updatedParent.userId) {
                    await prisma.user.update({
                        where: { id: updatedParent.userId },
                        data: {
                            name: fatherName?.trim(),
                            email: fatherEmail?.trim(),
                            mobile: fatherMobile?.trim()
                        }
                    });
                }
            } else {
                // Create new parent
                const newParent = await prisma.parent.create({
                    data: {
                        schoolId: existingStudent.schoolId,
                        ...parentUpdateData,
                        status: true
                    }
                });

                await prisma.student.update({
                    where: { id },
                    data: { parentId: newParent.id }
                });
            }
        }

        // ============================================
        // 6. UPDATE TRANSPORT
        // ============================================

        if (Object.keys(transportUpdateData).length > 0) {
            const transportExist = await prisma.studentTransport.findUnique({
                where: {
                    studentId: id,
                },
            });

            if (transportExist) {
                await prisma.studentTransport.update({
                    where: {
                        studentId: id,
                    },
                    data: transportUpdateData,
                });
            } else {
                await prisma.studentTransport.create({
                    data: {
                        studentId: id,
                        ...transportUpdateData,
                    },
                });
            }
        }

        // ============================================
        // 7. FETCH UPDATED STUDENT DATA
        // ============================================

        const data = await prisma.student.findUnique({
            where: { id },
            include: {
                class: true,
                section: true,
                session: true,
                parent: true,
                transportInfo: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true
                    }
                }
            }
        });

        // ============================================
        // 8. RETURN RESPONSE
        // ============================================

        const tabNames = {
            basic: 'Basic details',
            address: 'Address details',
            parents: 'Parent details',
            medical: 'Medical details',
            physical: 'Physical details',
            class: 'Class details',
            misc: 'Miscellaneous details',
            transport: 'Transport details'
        };

        return res.status(200).json({
            success: true,
            message: `${tabNames[updateTab] || 'Student'} updated successfully`,
            data
        });

    } catch (error) {
        console.error('Error updating student:', error);

        // Delete uploaded image if error occurs
        if (req.file) {
            const imagePath = req.file.path;
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Duplicate entry found',
                error: error.meta?.target
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update student',
            error: error.message
        });
    }
}

exports.status = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Check School
        const school = await prisma.school.findUnique({
            where: {
                id: req.user.schoolId,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }

        // Check Student
        const student = await prisma.student.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        // Convert StudentStatus -> User isActive
        const isActive = status === "ACTIVE";

        // Update Student
        const updatedStudent = await prisma.student.update({
            where: {
                id,
            },
            data: {
                status,
            },
        });

        // Update User
        if (student.userId) {
            await prisma.user.update({
                where: {
                    id: student.userId,
                },
                data: {
                    isActive,
                },
            });
        }

        return res.status(200).json({
            success: true,
            message: "Student status updated successfully",
            data: updatedStudent,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.parentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Check School
        const school = await prisma.school.findUnique({
            where: {
                id: req.user.schoolId,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }

        // Check Student
        const student = await prisma.student.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
            },
            include: {
                parent: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        if (!student.parent || !student.parent.userId) {
            return res.status(404).json({
                success: false,
                message: "Parent user account not found",
            });
        }

        const isActive = !status;





        const updatedUser = await prisma.user.update({
            where: {
                id: student.parent.userId,
            },
            data: {
                isActive,
            },
        });

        await prisma.parent.update({
            where: {
                id: student.parent.id,
            },
            data: {
                status: isActive,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Parent login ${isActive ? "enabled" : "disabled"} successfully.`,
            data: updatedUser,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.promotion = async (req, res) => {
    try {
        let {
            fromSessionId,
            toSessionId,
            fromClassId,
            toClassId,
            toSectionId,
            fromSectionId,
            studentData
        } = req.body;



        // Validate input
        if (!Array.isArray(studentData) || studentData.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No students selected for promotion."
            });
        }

        // Extract student IDs from studentData
        const studentIds = studentData.map(item => item.studentId);


        // Validate all required fields
        if (!fromSessionId || !toSessionId || !fromClassId || !toClassId || !toSectionId || !fromSectionId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: fromSessionId, toSessionId, fromClassId, toClassId, fromSectionId, toSectionId"
            });
        }

        const schoolId = req.user.schoolId;


        // 1. Check Current Session exists
        const currentSession = await prisma.academicSession.findFirst({
            where: {
                id: fromSessionId,
                schoolId: schoolId
            }
        });

        if (!currentSession) {
            return res.status(404).json({
                success: false,
                message: "Current session does not exist."
            });
        }

        // 2. Check Promote Session exists
        const promoteSession = await prisma.academicSession.findFirst({
            where: {
                id: toSessionId,
                schoolId: schoolId
            }
        });

        if (!promoteSession) {
            return res.status(404).json({
                success: false,
                message: "Promote session does not exist."
            });
        }

        // 3. Check From Class exists
        const fromClass = await prisma.class.findFirst({
            where: {
                id: fromClassId,
                schoolId: schoolId
            }
        });

        if (!fromClass) {
            return res.status(404).json({
                success: false,
                message: "From class does not exist."
            });
        }

        // 4. Check From Section exists
        const fromSection = await prisma.section.findFirst({
            where: {
                id: fromSectionId,
                schoolId: schoolId
            }
        });

        if (!fromSection) {
            return res.status(404).json({
                success: false,
                message: "From section does not exist."
            });
        }

        // 5. Check To Class exists
        const toClass = await prisma.class.findFirst({
            where: {
                id: toClassId,
                schoolId: schoolId
            }
        });

        if (!toClass) {
            return res.status(404).json({
                success: false,
                message: "To class does not exist."
            });
        }

        // 6. Check To Section exists
        const toSection = await prisma.section.findFirst({
            where: {
                id: toSectionId,
                schoolId: schoolId
            }
        });

        if (!toSection) {
            return res.status(404).json({
                success: false,
                message: "To section does not exist."
            });
        }

        // 7. Get students with their details
        const students = await prisma.student.findMany({
            where: {
                id: { in: studentIds },
                schoolId: schoolId,
                status: "ACTIVE"
            }
        });

        if (students.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No active students found with the provided IDs."
            });
        }



        // ✅ NEW: Check if students are already in target session
        const studentsInTargetSession = await prisma.student.findMany({
            where: {
                id: { in: studentIds },
                sessionId: toSessionId
            }
        });

        if (studentsInTargetSession.length > 0) {
            const alreadyPromotedIds = studentsInTargetSession.map(s => s.id);
            return res.status(400).json({
                success: false,
                message: `${studentsInTargetSession.length} student(s) are already in the target session.`,
                data: {
                    alreadyPromotedStudentIds: alreadyPromotedIds
                }
            });
        }

        // 8. Check if students already have enrollment in fromSession
        const existingEnrollments = await prisma.studentEnrollment.findMany({
            where: {
                studentId: { in: studentIds },
                sessionId: fromSessionId
            }
        });

        const existingStudentIds = existingEnrollments.map(e => e.studentId);
        // console.log(`📊 Existing enrollments: ${existingEnrollments.length}`);

        // 9. Create enrollment for students who don't have one
        const studentsToEnroll = students.filter(s => !existingStudentIds.includes(s.id));

        if (studentsToEnroll.length > 0) {


            const maxRollNo = await prisma.studentEnrollment.aggregate({
                where: {
                    classId: fromClassId,
                    sectionId: fromSectionId,
                    sessionId: fromSessionId
                },
                _max: {
                    rollNo: true
                }
            });

            let rollCounter = (maxRollNo._max.rollNo || 0);

            await prisma.$transaction(
                studentsToEnroll.map((student, index) => {
                    return prisma.studentEnrollment.create({
                        data: {
                            studentId: student.id,
                            sessionId: fromSessionId,
                            classId: fromClassId,
                            sectionId: fromSectionId,
                            rollNo: rollCounter + index + 1,
                            promotionResult: 'RETAINED',
                            schoolId: schoolId,
                            promotedAt: new Date(),
                            createdAt: new Date()
                        }
                    });
                })
            );


        }

        // 10. Now get all current enrollments
        const currentEnrollments = await prisma.studentEnrollment.findMany({
            where: {
                studentId: { in: studentIds },
                sessionId: fromSessionId,
                classId: fromClassId,
                sectionId: fromSectionId,
                student: {
                    schoolId: schoolId,
                    status: "ACTIVE"
                }
            },
            include: {
                student: true
            }
        });

        console.log(`📊 Current Enrollments Found: ${currentEnrollments.length}`);

        if (currentEnrollments.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Unable to create enrollments. Please check student data."
            });
        }

        // 11. Get valid student IDs from current enrollments
        const validStudentIds = currentEnrollments.map(e => e.studentId);

        // 12. Check if already promoted to target session (in enrollment table)
        const alreadyPromoted = await prisma.studentEnrollment.findMany({
            where: {
                studentId: { in: validStudentIds },
                sessionId: toSessionId
            }
        });

        let finalStudentIds = validStudentIds;
        if (alreadyPromoted.length > 0) {
            const alreadyPromotedIds = alreadyPromoted.map(e => e.studentId);
            finalStudentIds = validStudentIds.filter(id => !alreadyPromotedIds.includes(id));

            if (finalStudentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `All selected students are already promoted to the target session.`,
                    data: {
                        alreadyPromotedStudentIds: alreadyPromotedIds
                    }
                });
            }
        }

        // 13. Check if students are already enrolled in target class/section
        const alreadyInTarget = await prisma.studentEnrollment.findMany({
            where: {
                studentId: { in: finalStudentIds },
                sessionId: toSessionId,
                classId: toClassId,
                sectionId: toSectionId
            }
        });

        if (alreadyInTarget.length > 0) {
            const alreadyInTargetIds = alreadyInTarget.map(e => e.studentId);
            finalStudentIds = finalStudentIds.filter(id => !alreadyInTargetIds.includes(id));

            if (finalStudentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: `${alreadyInTarget.length} student(s) are already enrolled in the target class and section.`,
                    data: {
                        alreadyEnrolledStudentIds: alreadyInTargetIds
                    }
                });
            }
        }

        // 14. Filter current enrollments
        const enrollmentsToPromote = currentEnrollments.filter(e =>
            finalStudentIds.includes(e.studentId)
        );

        if (enrollmentsToPromote.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No students available for promotion after filtering."
            });
        }

        // 15. Separate students based on status
        const promoteStudents = studentData
            .filter(item => item.status === 'promote')
            .map(item => item.studentId);

        const failStudents = studentData
            .filter(item => item.status === 'fail')
            .map(item => item.studentId);

        const retainStudents = studentData
            .filter(item => item.status === 'retain')
            .map(item => item.studentId);

        console.log("📊 Status Breakdown:", {
            promote: promoteStudents.length,
            fail: failStudents.length,
            retain: retainStudents.length
        });

        // 16. Promotion Logic with Transaction
        const result = await prisma.$transaction(async (tx) => {
            let promotedCount = 0;
            let failedCount = 0;
            let retainedCount = 0;
            const promotedStudents = [];

            for (const enrollment of enrollmentsToPromote) {
                const studentId = enrollment.studentId;
                const status = studentData.find(item => item.studentId === studentId)?.status || 'promote';

                // For 'retain' status - do nothing
                if (status === 'retain') {
                    retainedCount++;
                    continue;
                }

                // For 'fail' status - move to new session but same class
                if (status === 'fail') {
                    // Get existing students in same class/section for roll number
                    const existingEnrollments = await tx.studentEnrollment.findMany({
                        where: {
                            classId: fromClassId,
                            sectionId: fromSectionId,
                            sessionId: toSessionId,
                            student: {
                                schoolId: schoolId,
                                status: "ACTIVE"
                            }
                        },
                        orderBy: {
                            rollNo: 'desc'
                        }
                    });

                    let newRollNo = 1;
                    if (existingEnrollments.length > 0) {
                        const maxRollNo = Math.max(
                            ...existingEnrollments
                                .map(e => e.rollNo)
                                .filter(rn => rn !== null && rn !== undefined),
                            0
                        );
                        newRollNo = maxRollNo + 1;
                    }

                    // Create new enrollment
                    const newEnrollment = await tx.studentEnrollment.create({
                        data: {
                            studentId: studentId,
                            sessionId: toSessionId,
                            classId: fromClassId,
                            sectionId: fromSectionId,
                            rollNo: newRollNo,
                            promotionResult: 'FAILED',
                            promotedAt: new Date(),
                            schoolId: schoolId
                        },
                        include: {
                            student: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    admissionNo: true
                                }
                            }
                        }
                    });

                    // ✅ UPDATE: Student table with new session (same class/section)
                    await tx.student.update({
                        where: { id: studentId },
                        data: {
                            sessionId: toSessionId,
                            classId: fromClassId,
                            sectionId: fromSectionId,
                            updatedAt: new Date()
                        }
                    });

                    // Update old enrollment
                    await tx.studentEnrollment.update({
                        where: {
                            id: enrollment.id
                        },
                        data: {
                            promotionResult: 'FAILED'
                        }
                    });

                    failedCount++;
                    promotedStudents.push({
                        id: newEnrollment.studentId,
                        name: `${newEnrollment.student.firstName} ${newEnrollment.student.lastName || ''}`.trim(),
                        admissionNo: newEnrollment.student.admissionNo,
                        newRollNo: newRollNo,
                        status: 'failed'
                    });
                    continue;
                }

                // For 'promote' status - move to new class and session
                if (status === 'promote') {
                    // Get existing students in target class/section for roll number
                    const existingEnrollments = await tx.studentEnrollment.findMany({
                        where: {
                            classId: toClassId,
                            sectionId: toSectionId,
                            sessionId: toSessionId,
                            student: {
                                schoolId: schoolId,
                                status: "ACTIVE"
                            }
                        },
                        orderBy: {
                            rollNo: 'desc'
                        }
                    });

                    let newRollNo = 1;
                    if (existingEnrollments.length > 0) {
                        const maxRollNo = Math.max(
                            ...existingEnrollments
                                .map(e => e.rollNo)
                                .filter(rn => rn !== null && rn !== undefined),
                            0
                        );
                        newRollNo = maxRollNo + 1;
                    }

                    // Create new enrollment for next session
                    const newEnrollment = await tx.studentEnrollment.create({
                        data: {
                            studentId: studentId,
                            sessionId: toSessionId,
                            classId: toClassId,
                            sectionId: toSectionId,
                            rollNo: newRollNo,
                            promotionResult: 'PROMOTED',
                            promotedAt: new Date(),
                            schoolId: schoolId
                        },
                        include: {
                            student: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    admissionNo: true
                                }
                            }
                        }
                    });

                    // ✅ UPDATE: Student table with new session, class, section
                    await tx.student.update({
                        where: { id: studentId },
                        data: {
                            sessionId: toSessionId,
                            classId: toClassId,
                            sectionId: toSectionId,
                            updatedAt: new Date()
                        }
                    });

                    // Update old enrollment
                    await tx.studentEnrollment.update({
                        where: {
                            id: enrollment.id
                        },
                        data: {
                            promotionResult: 'PROMOTED'
                        }
                    });

                    promotedCount++;
                    promotedStudents.push({
                        id: newEnrollment.studentId,
                        name: `${newEnrollment.student.firstName} ${newEnrollment.student.lastName || ''}`.trim(),
                        admissionNo: newEnrollment.student.admissionNo,
                        newRollNo: newRollNo,
                        status: 'promoted'
                    });
                }
            }

            return {
                promotedCount,
                failedCount,
                retainedCount,
                promotedStudents
            };
        });

        // 17. Prepare response
        const responseMessage = [];
        if (result.promotedCount > 0) {
            responseMessage.push(`${result.promotedCount} student(s) promoted`);
        }
        if (result.failedCount > 0) {
            responseMessage.push(`${result.failedCount} student(s) failed`);
        }
        if (result.retainedCount > 0) {
            responseMessage.push(`${result.retainedCount} student(s) retained`);
        }

        return res.status(200).json({
            success: true,
            message: responseMessage.join(', ') + ' successfully.',
            data: {
                fromSession: currentSession.name || fromSessionId,
                toSession: promoteSession.name || toSessionId,
                fromClass: fromClass.name || fromClassId,
                fromSection: fromSection.name || fromSectionId,
                toClass: toClass.name || toClassId,
                toSection: toSection.name || toSectionId,
                promotedCount: result.promotedCount,
                failedCount: result.failedCount,
                retainedCount: result.retainedCount,
                promotedStudents: result.promotedStudents
            }
        });

    } catch (error) {
        console.error("❌ Promotion Error:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred during student promotion.",
            error: error.message
        });
    }
};





exports.getTC = async (req, res) => {
    try {
        const { studentId } = req.params;
        const schoolId = req.user.schoolId;

        // Validate studentId
        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student ID is required"
            });
        }

        // Fetch student details
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                schoolId: schoolId
            },
            include: {
                user: true,
                class: true,
                section: true,
                session: true,
                parent: true,
                school: true
            }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Student details fetched successfully",
            data: student
        });

    } catch (error) {
        console.error("❌ Error fetching TC data:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch student data"
        });
    }
};



const PDFDocument = require('pdfkit');
const { format } = require('date-fns');


const axios = require('axios');



const getImageBuffer = async (imageUrl) => {
    try {
        if (!imageUrl) return null;

        if (imageUrl.startsWith('http')) {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        }

        if (fs.existsSync(imageUrl)) {
            return fs.readFileSync(imageUrl);
        }

        return null;
    } catch (error) {
        console.error('Error loading image:', error);
        return null;
    }
};

const generateTCPDF = async (studentData, tcData, signatures = {}, schoolLogo = null) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 30,
                info: {
                    Title: 'Transfer Certificate',
                    Author: tcData.schoolName || 'School',
                    Subject: 'Transfer Certificate',
                }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Format date functions
            const formatDate = (date) => {
                if (!date) return 'N/A';
                return format(new Date(date), 'dd/MM/yyyy');
            };

            const formatDateWord = (date) => {
                if (!date) return 'N/A';
                return format(new Date(date), 'dd MMMM yyyy');
            };

            // ============ DYNAMIC DATA ============
            const schoolName = tcData.schoolName || 'The Smart Public School';
            const schoolAddress = tcData.schoolAddress || '';
            const schoolCity = tcData.schoolCity || '';
            const schoolState = tcData.schoolState || '';
            const schoolPincode = tcData.schoolPincode || '';
            const schoolPhone = tcData.schoolPhone || '';
            const schoolEmail = tcData.schoolEmail || '';
            const schoolWebsite = tcData.schoolWebsite || '';
            const schoolCode = tcData.schoolCode || '';
            const affiliationNo = tcData.schoolAffiliationNo || '';
            const board = tcData.board || 'CBSE';

            // Student Data
            const studentName = tcData.studentName || '';
            const motherName = tcData.motherName || '';
            const fatherName = tcData.fatherName || '';
            const nationality = tcData.nationality || 'Indian';
            const category = tcData.category || 'General';
            const admissionDate = tcData.admissionDate;
            const className = tcData.className || '';
            const sectionName = tcData.sectionName || '';
            const dob = tcData.dob;
            const admissionNo = tcData.admissionNo || '';

            // TC Data
            const failed = tcData.failed || 'NO';
            const subjects = tcData.subjects || 'English, EVS, Hindi, Mathematics';
            const promotedTo = tcData.promotedTo || 'SECOND';
            const duesPaid = tcData.duesPaid || 'NO';
            const concession = tcData.concession || 'NO';
            const workingDays = tcData.workingDays || '250';
            const presentDays = tcData.presentDays || '240';
            const nccScout = tcData.nccScout || 'NO';
            const activities = tcData.activities || 'YES';
            const conduct = tcData.conduct || 'Excellent';
            const applicationDate = tcData.applicationDate || new Date();
            const issueDate = tcData.issueDate || new Date();
            const reason = tcData.reason || 'DISTRICT CHANGE';
            const remarks = tcData.remarks || 'NO';
            const bookNo = tcData.bookNo || '001';
            const srNo = tcData.srNo || studentData?.id?.slice(0, 8) || '001';

            // ============ PAGE 1 - SINGLE PAGE ============

            let currentY = 40;

            // Decorative Top Border
            doc.rect(50, currentY, 495, 4).fill('#7C3AED');
            currentY += 15;

            // ============ SCHOOL HEADER WITH LOGO LEFT ============
            let logoY = currentY;

            // Logo - LEFT SIDE
            if (schoolLogo) {
                try {
                    const logoBuffer = await getImageBuffer(schoolLogo);
                    if (logoBuffer) {
                        doc.image(logoBuffer, 50, currentY - 5, {
                            width: 70,
                            height: 70
                        });
                        logoY = currentY;
                    }
                } catch (error) {
                    console.error('Error loading logo:', error);
                }
            }

            // School Name - CENTERED
            const textStartX = schoolLogo ? 130 : 50;
            const textWidth = schoolLogo ? 415 : 495;

            doc.fontSize(20)
                .font('Helvetica-Bold')
                .fillColor('#1F2937')
                .text(schoolName, textStartX, logoY, {
                    align: 'center',
                    width: textWidth
                });

            doc.fontSize(11)
                .font('Helvetica')
                .fillColor('#4B5563')
                .text(`(Affiliated to ${board} New Delhi)`, textStartX, doc.y + 3, {
                    align: 'center',
                    width: textWidth
                });

            doc.fontSize(9)
                .fillColor('#6B7280')
                .text(`${schoolAddress}, ${schoolCity}, ${schoolState} - ${schoolPincode}`, textStartX, doc.y + 3, {
                    align: 'center',
                    width: textWidth
                });

            // Contact Info - CENTERED
            let contactInfo = `Phone: ${schoolPhone}`;
            if (schoolEmail) contactInfo += ` | Email: ${schoolEmail}`;
            if (schoolWebsite) contactInfo += ` | Website: ${schoolWebsite}`;

            doc.fontSize(8)
                .fillColor('#6B7280')
                .text(contactInfo, textStartX, doc.y + 3, {
                    align: 'center',
                    width: textWidth
                });

            // Affiliation Info - CENTERED
            let affiliationInfo = '';
            if (affiliationNo) affiliationInfo += `Affiliation No: ${affiliationNo}`;
            if (schoolCode) {
                if (affiliationInfo) affiliationInfo += ' | ';
                affiliationInfo += `School Code: ${schoolCode}`;
            }

            if (affiliationInfo) {
                doc.fontSize(9)
                    .fillColor('#4B5563')
                    .text(affiliationInfo, textStartX, doc.y + 3, {
                        align: 'center',
                        width: textWidth
                    });
            }

            // Divider Line
            const lineY = doc.y + 8;
            doc.moveTo(50, lineY).lineTo(545, lineY).stroke('#D1D5DB');

            // TC Title - CENTERED
            doc.fontSize(18)
                .font('Helvetica-Bold')
                .fillColor('#7C3AED')
                .text('TRANSFER CERTIFICATE', 50, lineY + 10, {
                    align: 'center',
                    width: 495,
                    underline: true
                });

            // ============ BOOK NO AND SR NO BOXES ============
            const boxY = doc.y + 8;

            // Box 1: Book No

            doc.rect(50, boxY, 150, 35)
                .fillAndStroke('#F3E8FF', '#7C3AED');

            doc.fillColor('#6D28D9')
                .fontSize(8)
                .font('Helvetica-Bold')
                .text('Book No.', 55, boxY + 5, {
                    width: 140,
                    align: 'center'
                });

            doc.fillColor('#7C3AED')
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(bookNo ? String(bookNo) : '001', 55, boxY + 16, {
                    width: 140,
                    align: 'center'
                });


            // Box 2: Sr No
            doc.rect(200, boxY, 150, 35)
                .fillAndStroke('#E0E7FF', '#4F46E5');

            doc.fillColor('#4338CA')
                .fontSize(8)
                .font('Helvetica-Bold')
                .text('Sr No.', 200, boxY + 5, {
                    width: 150,
                    align: 'center'
                });

            doc.fontSize(5) // 5 ya 6
                .fillColor('#4F46E5')
                .text(String(srNo), 200, boxY + 16, {
                    width: 150,
                    align: 'center'
                });

            // Box 3: Admission No
            doc.rect(350, boxY, 195, 35)
                .fillAndStroke('#D1FAE5', '#059669');
            doc.fillColor('#065F46')
                .fontSize(8)
                .font('Helvetica-Bold')
                .text('Admission No.', 355, boxY + 5, { align: 'center' });
            doc.fontSize(11)
                .fillColor('#059669')
                .text(admissionNo || 'N/A', 355, boxY + 16, { align: 'center' });

            // ============ TC CONTENT ============
            let y = boxY + 48;
            const maxY = 620;

            const renderRow = (number, label, value) => {
                if (y > maxY) return false;

                const numberX = 50;
                const labelX = 72;
                const valueX = 200;

                doc.fontSize(9)
                    .font('Helvetica-Bold')
                    .fillColor('#7C3AED')
                    .text(`${number}.`, numberX, y, { width: 20 });

                doc.fontSize(9)
                    .font('Helvetica')
                    .fillColor('#4B5563')
                    .text(label, labelX, y, { width: 125 });

                doc.fontSize(9)
                    .font('Helvetica-Bold')
                    .fillColor('#1F2937')
                    .text(value || 'N/A', valueX, y, { width: 300 });

                y = doc.y + 11;
                return true;
            };

            // Render all 23 fields
            const rows = [
                ['1', 'Name', studentName],
                ['2', "Mother's Name", motherName],
                ['3', "Father's/Guardian's Name", fatherName],
                ['4', 'Nationality', nationality],
                ['5', 'SC/ST/OBC', category],
                ['6', 'Date of first admission', `${formatDate(admissionDate)} (${className || 'N/A'})`],
                ['7', 'Date of Birth', `${formatDate(dob)} (${formatDateWord(dob)})`],
                ['8', 'Class last studied', `${className || 'N/A'}${sectionName ? ` (Section ${sectionName})` : ''}`],
                ['9', 'Board/Exam with result', board],
                ['10', 'Failed (if any)', failed],
                ['11', 'Subjects Studied', subjects],
                ['12', 'Promoted to Class', promotedTo],
                ['13', 'Dues paid upto', duesPaid],
                ['14', 'Fee Concession', concession],
                ['15', 'Working Days', workingDays],
                ['16', 'Present Days', presentDays],
                ['17', 'NCC/Scout/Guide', nccScout],
                ['18', 'Extra Curricular Activities', activities],
                ['19', 'General Conduct', conduct],
                ['20', 'Application Date', formatDate(applicationDate)],
                ['21', 'Issue Date', formatDate(issueDate)],
                ['22', 'Reason for Leaving', reason],
                ['23', 'Any Other Remarks', remarks]
            ];

            for (const row of rows) {
                const [number, label, value] = row;
                const result = renderRow(number, label, value);
                if (!result) break;
            }

            // ============ SIGNATURE SECTION AT BOTTOM ============
            const sigY = Math.min(y + 15, 720);

            // Signature Box Border
            doc.rect(50, sigY, 495, 85)
                .stroke('#D1D5DB');

            const sigStartY = sigY + 10;

            // Prepared by
            if (signatures?.preparedBy) {
                try {
                    const sigBuffer = Buffer.from(signatures.preparedBy.split(',')[1], 'base64');
                    doc.image(sigBuffer, 80, sigStartY, {
                        width: 90,
                        height: 25
                    });
                } catch (error) {
                    doc.moveTo(80, sigStartY + 30).lineTo(170, sigStartY + 30).stroke('#9CA3AF');
                }
            } else {
                doc.moveTo(80, sigStartY + 30).lineTo(170, sigStartY + 30).stroke('#9CA3AF');
            }

            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#4B5563')
                .text('Prepared by', 80, sigStartY + 35);
            doc.fontSize(7)
                .font('Helvetica')
                .fillColor('#6B7280')
                .text('Sign. with Name & Desg.', 80, sigStartY + 48);

            // Checked by
            if (signatures?.checkedBy) {
                try {
                    const sigBuffer = Buffer.from(signatures.checkedBy.split(',')[1], 'base64');
                    doc.image(sigBuffer, 215, sigStartY, {
                        width: 90,
                        height: 25
                    });
                } catch (error) {
                    doc.moveTo(215, sigStartY + 30).lineTo(305, sigStartY + 30).stroke('#9CA3AF');
                }
            } else {
                doc.moveTo(215, sigStartY + 30).lineTo(305, sigStartY + 30).stroke('#9CA3AF');
            }

            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#4B5563')
                .text('Checked by', 215, sigStartY + 35);
            doc.fontSize(7)
                .font('Helvetica')
                .fillColor('#6B7280')
                .text('Sign. with Name & Desg.', 215, sigStartY + 48);

            // Principal
            if (signatures?.principal) {
                try {
                    const sigBuffer = Buffer.from(signatures.principal.split(',')[1], 'base64');
                    doc.image(sigBuffer, 350, sigStartY, {
                        width: 90,
                        height: 25
                    });
                } catch (error) {
                    doc.moveTo(350, sigStartY + 30).lineTo(440, sigStartY + 30).stroke('#9CA3AF');
                }
            } else {
                doc.moveTo(350, sigStartY + 30).lineTo(440, sigStartY + 30).stroke('#9CA3AF');
            }

            doc.fontSize(9)
                .font('Helvetica-Bold')
                .fillColor('#4B5563')
                .text('Principal', 350, sigStartY + 35);
            doc.fontSize(7)
                .font('Helvetica')
                .fillColor('#6B7280')
                .text('with seal', 350, sigStartY + 48);

            // Footer Note
            const footerY = sigY + 90;
            doc.fontSize(7)
                .font('Helvetica')
                .fillColor('#9CA3AF')
                .text('This is a computer generated certificate', 50, footerY, {
                    align: 'center',
                    width: 495
                });

            // Bottom decorative border
            doc.rect(50, footerY + 12, 495, 4).fill('#7C3AED');

            doc.end();

        } catch (error) {
            console.error('PDF Generation Error:', error);
            reject(error);
        }
    });
};

exports.tcDownload = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { studentData, tcData, signatures } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student ID is required",
            });
        }

        if (!tcData) {
            return res.status(400).json({
                success: false,
                message: "TC Data is required",
            });
        }

        // Get school logo from studentData or fetch from DB
        const schoolLogo = studentData?.school?.logo || tcData?.schoolLogo || null;

        // Generate PDF with all dynamic data
        const pdfBuffer = await generateTCPDF(
            studentData,
            tcData,
            signatures || {},
            schoolLogo
        );

        // Set headers for PDF download
        const filename = `TC_${tcData.admissionNo || studentId}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.send(pdfBuffer);

        

    } catch (error) {
        console.error("TC Download Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};








function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
}

