const { PrismaClient } = require('@prisma/client');
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const { sendMail } = require('../../config/mail');
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = req.query.search?.trim();
        const { status, classId, sectionId, qualification } = req.query;

        const where = {
            schoolId: req.user.schoolId,

            ...(status !== undefined && {
                status: status === "true",
            }),

            ...(search && {
                OR: [
                    {
                        employeeId: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
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
                        mobile: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                ],
            }),

            ...((classId || sectionId) && {
                subjects: {
                    some: {
                        ...(classId && { classId }),
                        ...(sectionId && { sectionId }),
                    },
                },
            }),
            ...(qualification && {
                qualification: {
                    contains: qualification,
                    mode: "insensitive",
                },
            }),
        };

        const totalTeachers = await prisma.teacher.count({
            where,
        });

        const teachers = await prisma.teacher.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                gender: true,
                email: true,
                mobile: true,
                qualification: true,
                experience: true,
                salary: true,
                joiningDate: true,
                dob: true,
                image: true,
                type: true,
                notes: true,
                status: true,
                createdAt: true,

                subjects: {
                    select: {
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
                        subject: {
                            select: {
                                id: true,
                                subjectName: true,
                                shortName: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedTeachers = teachers.map((teacher) => {
            const classesCanTeach = [
                ...new Set(
                    teacher.subjects.map(
                        (item) =>
                            `${item.class.sortName || item.class.className} - ${item.section.sectionName}`
                    )
                ),
            ];

            const subjectsCanTeach = [
                ...new Set(
                    teacher.subjects.map(
                        (item) => item.subject.subjectName
                    )
                ),
            ];

            return {
                id: teacher.id,
                employeeId: teacher.employeeId,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                gender: teacher.gender,
                email: teacher.email,
                mobile: teacher.mobile,
                qualification: teacher.qualification,
                experience: teacher.experience,
                salary: teacher.salary,
                joiningDate: teacher.joiningDate,
                dob: teacher.dob,
                image: teacher.image,
                status: teacher.status,
                type: teacher.type,
                notes: teacher.notes,
                createdAt: teacher.createdAt,
                classesCanTeach,
                subjectsCanTeach,
            };
        });

        return res.status(200).json({
            success: true,
            message: "Teachers fetched successfully.",
            data: formattedTeachers,
            pagination: getPaginationMeta(page, limit, totalTeachers),
        });

    } catch (error) {
        console.error("Teacher Index Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.teacherIndex = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = req.query.search?.trim();
        const { status, classId, sectionId, qualification } = req.query;

        const where = {
            schoolId: req.user.schoolId,
            type: "TEACHER",

            ...(status !== undefined && {
                status: status === "true",
            }),

            ...(search && {
                OR: [
                    {
                        employeeId: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
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
                        mobile: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                ],
            }),

            ...((classId || sectionId) && {
                subjects: {
                    some: {
                        ...(classId && { classId }),
                        ...(sectionId && { sectionId }),
                    },
                },
            }),
            ...(qualification && {
                qualification: {
                    contains: qualification,
                    mode: "insensitive",
                },
            }),
        };

        const totalTeachers = await prisma.teacher.count({
            where,
        });

        const teachers = await prisma.teacher.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                gender: true,
                email: true,
                mobile: true,
                qualification: true,
                experience: true,
                salary: true,
                joiningDate: true,
                dob: true,
                image: true,
                type: true,
                notes: true,
                status: true,
                createdAt: true,

                subjects: {
                    select: {
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
                        subject: {
                            select: {
                                id: true,
                                subjectName: true,
                                shortName: true,
                            },
                        },
                    },
                },
            },
        });

        const formattedTeachers = teachers.map((teacher) => {
            const classesCanTeach = [
                ...new Set(
                    teacher.subjects.map(
                        (item) =>
                            `${item.class.sortName || item.class.className} - ${item.section.sectionName}`
                    )
                ),
            ];

            const subjectsCanTeach = [
                ...new Set(
                    teacher.subjects.map(
                        (item) => item.subject.subjectName
                    )
                ),
            ];

            return {
                id: teacher.id,
                employeeId: teacher.employeeId,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                gender: teacher.gender,
                email: teacher.email,
                mobile: teacher.mobile,
                qualification: teacher.qualification,
                experience: teacher.experience,
                salary: teacher.salary,
                joiningDate: teacher.joiningDate,
                dob: teacher.dob,
                image: teacher.image,
                status: teacher.status,
                type: teacher.type,
                notes: teacher.notes,
                createdAt: teacher.createdAt,
                classesCanTeach,
                subjectsCanTeach,
            };
        });

        return res.status(200).json({
            success: true,
            message: "Teachers fetched successfully.",
            data: formattedTeachers,
            pagination: getPaginationMeta(page, limit, totalTeachers),
        });

    } catch (error) {
        console.error("Teacher Index Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.getTeachersClassIdOrSectionId = async (req, res) => {
    try {
        const { classId, sectionId, teacherId,subjectId } = req.query;

        const where = {
            schoolId: req.user.schoolId,
            ...(classId && { classId }),
            ...(sectionId && { sectionId }),
            ...(teacherId && { teacherId }),
            ...(subjectId && { subjectId }),
        };

        const teacherSubjects = await prisma.teacherSubject.findMany({
            where,
            include: {
                teacher: {
                    select: {
                        id: true,
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        qualification: true,
                    },
                },
                subject: {
                    select: {
                        id: true,
                        subjectName: true,
                        shortName: true,
                        subjectCode: true,
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
            },
            orderBy: {
                teacher: {
                    firstName: "asc",
                },
            },
        });

        return res.status(200).json({
            success: true,
            count: teacherSubjects.length,
            data: teacherSubjects,
        });

    } catch (error) {
        console.error("Teacher Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getallTeacher = async (req, res) => {
    try {
        const teachers = await prisma.teacher.findMany({
            where: {
                schoolId: req.user.schoolId,
                status: true,
                type: "TEACHER"
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                qualification: true,
            },
            orderBy: {
                firstName: "asc",
            },
        });

        return res.status(200).json({
            success: true,
            data: teachers,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

exports.store = async (req, res) => {
    try {
        let {
            employeeId,
            firstName,
            lastName,
            gender,
            email,
            mobile,
            qualification,
            experience,
            salary,
            joiningDate,
            type,
            notes
        } = req.body;

        // ✅ Validation
        if (!employeeId?.trim() || !firstName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and First Name are required.",
            });
        }

        const allowedTypes = [
            "TEACHER",
            "ACCOUNTANT",
            "CLERK",
            "LIBRARIAN",
            "RECEPTIONIST",
            "PRINCIPAL",
            "VICE_PRINCIPAL",
            "COORDINATOR",
            "SPORTS_TEACHER",
            "LAB_ASSISTANT",
            "TRANSPORT_MANAGER",
            "DRIVER",
            "CONDUCTOR",
            "SECURITY_GUARD",
            "PEON",
            "HOSTEL_WARDEN",
            "NURSE",
            "OTHER"
        ];

        type = type?.trim().toUpperCase() || "TEACHER";

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee type."
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

        // ✅ Sanitize inputs
        employeeId = employeeId.trim().toUpperCase();
        firstName = firstName.trim();
        lastName = lastName?.trim() || null;
        email = email?.trim().toLowerCase() || null;
        mobile = mobile?.trim() || null;
        qualification = qualification?.trim() || null;

        // ✅ Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: req.user.schoolId }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        // ✅ Check if school is approved
        if (school.status !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "School is not approved. Please contact super admin."
            });
        }

        // ✅ Duplicate Check in Teacher table
        const existingTeacher = await prisma.teacher.findFirst({
            where: {
                schoolId: req.user.schoolId,
                OR: [
                    { employeeId },
                    ...(email ? [{ email }] : []),
                    ...(mobile ? [{ mobile }] : []),
                ],
            },
        });

        if (existingTeacher) {
            let message = "Teacher already exists.";
            if (existingTeacher.employeeId === employeeId) {
                message = "Employee ID already exists.";
            } else if (email && existingTeacher.email === email) {
                message = "Email already exists.";
            } else if (mobile && existingTeacher.mobile === mobile) {
                message = "Mobile number already exists.";
            }
            return res.status(409).json({ success: false, message });
        }

        // ✅ Get TEACHER Role
        const role = await prisma.role.findUnique({
            where: { name: "TEACHER" }
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "TEACHER role not found. Please create TEACHER role first."
            });
        }

        // ✅ Check if email already exists in User table
        if (email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: email }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists in user system."
                });
            }
        }

        // ✅ Check if mobile already exists in User table
        if (mobile) {
            const existingUser = await prisma.user.findFirst({
                where: { mobile: mobile }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Mobile number already exists in user system."
                });
            }
        }

        // ✅ Generate Password
        const plainPassword = crypto
            .randomBytes(8)
            .toString("base64")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 10);

        console.log("📝 Generated Password for:", email);
        console.log("🔑 Plain Password:", plainPassword);

        // ✅ Hash Password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);


        // ✅ Create User
        const user = await prisma.user.create({
            data: {
                schoolId: req.user.schoolId,

                roleId: role.id,
                name: `${firstName} ${lastName || ""}`.trim(),
                email,
                mobile,
                password: hashedPassword,
                isActive: true
            }
        });

        // ✅ Create Teacher
        const teacher = await prisma.teacher.create({
            data: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                userId: user.id, // relation
                employeeId: employeeId,
                firstName: firstName,
                lastName: lastName,
                gender: gender,
                email: email,
                mobile: mobile,
                qualification: qualification,
                experience: experience ? Number(experience) : null,
                salary: salary ? Number(salary) : null,
                joiningDate: joiningDate ? new Date(joiningDate) : null,
                type: type,
                status: true
            }
        });





        // ✅ Send Email with proper error handling
        let emailSent = false;
        if (email) {
            try {
                const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to GlobalEdu CRM</title>
    <style>
        body { margin: 0; padding: 0; background: #f5f5f5; font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; padding: 25px; text-align: center; color: #fff; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 35px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .details { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details td { padding: 12px; border: 1px solid #ddd; }
        .details .label { font-weight: bold; background: #fafafa; }
        .button { display: inline-block; background: #dc2626; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        .password-box { background: #f8f8f8; padding: 15px; border-radius: 6px; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 10px 0; }
        .warning { color: #e74c3c; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0;">GlobalEdu CRM</h1>
            <p style="margin-top:8px;">School Management System</p>
        </div>
        <div class="content">
            <h2 style="margin-top:0;color:#333;">Welcome ${firstName} ${lastName || ''}! 👋</h2>
            <p>Your Teacher account has been created successfully. Here are your login credentials:</p>
            
            <table class="details">
                <tr>
                    <td class="label">🏫 School Name</td>
                    <td>${school.name}</td>
                </tr>
                <tr>
                    <td class="label">🆔 Employee ID</td>
                    <td><strong>${employeeId}</strong></td>
                </tr>
                <tr>
                    <td class="label">📧 Email</td>
                    <td><strong>${email}</strong></td>
                </tr>
                <tr>
                    <td class="label">🔑 Temporary Password</td>
                    <td>
                        <div class="password-box">${plainPassword}</div>
                    </td>
                </tr>
            </table>
            
            <div style="text-align:center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="button">
                    🚀 Login Now
                </a>
            </div>
            
            <div style="background:#fff3cd;padding:15px;border-radius:6px;border-left:4px solid #ffc107;margin:20px 0;">
                <p style="margin:0;color:#856404;">
                    <span class="warning">⚠️ Important:</span> For security reasons, please change your password after your first login.
                </p>
            </div>
            
            <p style="color:#555;margin-top:20px;">
                Regards,<br>
                <strong>GlobalEdu CRM Team</strong>
            </p>
        </div>
        <div class="footer">
            © ${new Date().getFullYear()} GlobalEdu CRM. All Rights Reserved.
        </div>
    </div>
</body>
</html>
                `;

                const info = await sendMail({
                    to: email,
                    subject: `Welcome To ${school.name} - Teacher Account Created`,
                    html: emailHTML
                });

                emailSent = true;
                console.log("✅ Email sent successfully to:", email);
                console.log("Mail Sent:", info.response);
            } catch (err) {
                console.error("Email Error:");
                console.error(err);
                console.error(err.message);
                console.error(err.stack);
                // Don't fail the request if email fails
            }
        } else {
            console.log("⚠️ No email provided, skipping email send");
        }

        // ✅ Remove password from response
        const userResponse = { ...user };
        delete userResponse.password;

        return res.status(201).json({
            success: true,
            message: emailSent
                ? "Teacher created successfully. Login credentials sent to email."
                : "Teacher created successfully but email could not be sent. Please contact admin.",
            data: {
                teacher: teacher,
                user: userResponse
            }
        });

    } catch (error) {
        console.error("❌ Store Teacher Error:", error);
        console.error("❌ Error stack:", error.stack);

        // ✅ Better error handling
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: "Duplicate entry. Please check employee ID, email or mobile."
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};


exports.status = async (req, res) => {
    try {
        const { id } = req.params;

        // Check School
        const school = await prisma.school.findFirst({
            where: {
                id: req.user.schoolId,
                status: "APPROVED",
            },
        });

        if (!school) {
            return res.status(403).json({
                success: false,
                message: "School is not approved.",
            });
        }

        // Check Teacher
        const teacher = await prisma.teacher.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId,
            },
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found.",
            });
        }

        const newStatus = !teacher.status;

        // Update Teacher
        const updatedTeacher = await prisma.teacher.update({
            where: { id },
            data: {
                status: newStatus,
            },
        });

        // Update User Status
        await prisma.user.updateMany({
            where: {
                id: teacher.userId,
            },
            data: {
                isActive: newStatus,
            },
        });

        return res.status(200).json({
            success: true,
            message: `Teacher ${newStatus ? "activated" : "deactivated"} successfully.`,
            data: updatedTeacher,
        });

    } catch (error) {
        console.error("Teacher Status Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.show = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Teacher ID is required.",
            });
        }

        const teacher = await prisma.teacher.findFirst({
            where: {
                id,
                schoolId,
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                gender: true,
                email: true,
                mobile: true,
                dob: true,
                qualification: true,
                experience: true,
                salary: true,
                joiningDate: true,
                image: true,
                status: true,
                createdAt: true,

                subjects: {
                    select: {
                        classId: true,
                        sectionId: true,
                        subjectId: true,

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

                        subject: {
                            select: {
                                id: true,
                                subjectName: true,
                                shortName: true,
                            },
                        },
                    },
                    orderBy: [
                        {
                            class: {
                                className: "asc",
                            },
                        },
                        {
                            section: {
                                sectionName: "asc",
                            },
                        },
                        {
                            subject: {
                                subjectName: "asc",
                            },
                        },
                    ],
                },
            },
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found.",
            });
        }

        // Group Class -> Section -> Subjects
        const assignmentMap = {};

        teacher.subjects.forEach((item) => {
            if (!assignmentMap[item.classId]) {
                assignmentMap[item.classId] = {
                    classId: item.class.id,
                    className: item.class.className,
                    sortName: item.class.sortName,
                    sections: {},
                };
            }

            if (!assignmentMap[item.classId].sections[item.sectionId]) {
                assignmentMap[item.classId].sections[item.sectionId] = {
                    sectionId: item.section.id,
                    sectionName: item.section.sectionName,
                    subjectIds: [],
                    subjects: [],
                };
            }

            assignmentMap[item.classId].sections[item.sectionId].subjectIds.push(
                item.subject.id
            );

            assignmentMap[item.classId].sections[item.sectionId].subjects.push({
                id: item.subject.id,
                subjectName: item.subject.subjectName,
                shortName: item.subject.shortName,
            });
        });

        const assignments = Object.values(assignmentMap).map((cls) => ({
            classId: cls.classId,
            className: cls.className,
            sortName: cls.sortName,
            sections: Object.values(cls.sections),
        }));

        return res.status(200).json({
            success: true,
            message: "Teacher fetched successfully.",
            data: {
                id: teacher.id,
                employeeId: teacher.employeeId,
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                gender: teacher.gender,
                email: teacher.email,
                mobile: teacher.mobile,
                dob: teacher.dob,
                qualification: teacher.qualification,
                experience: teacher.experience,
                salary: teacher.salary,
                joiningDate: teacher.joiningDate,
                image: teacher.image,
                status: teacher.status,
                createdAt: teacher.createdAt,
                assignments,
            },
        });
    } catch (error) {
        console.error("Show Teacher Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.update = async (req, res) => {
    try {

        const { id } = req.params;


        let {
            employeeId,
            firstName,
            lastName,
            gender,
            email,
            mobile,
            qualification,
            experience,
            salary,
            joiningDate,
            type,
            notes,
            dob,
        } = req.body;

        // Validation
        if (!employeeId?.trim() || !firstName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and First Name are required."
            });
        }

        const allowedTypes = [
            "TEACHER",
            "ACCOUNTANT",
            "CLERK",
            "LIBRARIAN",
            "RECEPTIONIST",
            "PRINCIPAL",
            "VICE_PRINCIPAL",
            "COORDINATOR",
            "SPORTS_TEACHER",
            "LAB_ASSISTANT",
            "TRANSPORT_MANAGER",
            "DRIVER",
            "CONDUCTOR",
            "SECURITY_GUARD",
            "PEON",
            "HOSTEL_WARDEN",
            "NURSE",
            "OTHER"
        ];

        type = type?.trim().toUpperCase() || "TEACHER";

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee type."
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

        // Sanitize
        employeeId = employeeId.trim().toUpperCase();
        firstName = firstName.trim();
        lastName = lastName?.trim() || null;
        email = email?.trim().toLowerCase() || null;
        mobile = mobile?.trim() || null;
        qualification = qualification?.trim() || null;

        // file 
        const image = req.file?.path || null;

        // Find Teacher
        const teacher = await prisma.teacher.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId
            }
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found."
            });
        }

        // Duplicate Teacher Check
        const duplicateTeacher = await prisma.teacher.findFirst({
            where: {
                schoolId: req.user.schoolId,
                id: {
                    not: id
                },
                OR: [
                    { employeeId },
                    ...(email ? [{ email }] : []),
                    ...(mobile ? [{ mobile }] : [])
                ]
            }
        });

        if (duplicateTeacher) {
            let message = "Teacher already exists.";

            if (duplicateTeacher.employeeId === employeeId) {
                message = "Employee ID already exists.";
            } else if (duplicateTeacher.email === email) {
                message = "Email already exists.";
            } else if (duplicateTeacher.mobile === mobile) {
                message = "Mobile number already exists.";
            }

            return res.status(409).json({
                success: false,
                message
            });
        }

        // Find User using teacher.userId
        const user = teacher.userId
            ? await prisma.user.findUnique({
                where: {
                    id: teacher.userId
                }
            })
            : null;

        // Email Duplicate Check
        if (email) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    email,
                    ...(user && {
                        id: {
                            not: user.id
                        }
                    })
                }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Email already exists in user system."
                });
            }
        }

        // Mobile Duplicate Check
        if (mobile) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    mobile,
                    ...(user && {
                        id: {
                            not: user.id
                        }
                    })
                }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Mobile number already exists in user system."
                });
            }
        }

        // Update Teacher
        const updatedTeacher = await prisma.teacher.update({
            where: {
                id
            },
            data: {
                employeeId,
                sessionId: currentSession.id,
                firstName,
                lastName,
                gender,
                email,
                mobile,
                qualification,
                experience: experience ? Number(experience) : null,
                salary: salary ? Number(salary) : null,
                dob: dob ? new Date(dob) : null,
                image: image || null,
                type: type,
                notes: notes || null,
                joiningDate: joiningDate ? new Date(joiningDate) : null
            }
        });

        // Update User
        if (user) {
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    name: `${firstName} ${lastName || ""}`.trim(),
                    email,
                    mobile
                }
            });
        }

        // Fetch Updated Record
        const result = await prisma.teacher.findUnique({
            where: {
                id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
                        isActive: true
                    }
                },
                school: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: "Teacher updated successfully.",
            data: result
        });

    } catch (error) {
        console.error(error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Duplicate entry found."
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        // Check Teacher
        const teacher = await prisma.teacher.findFirst({
            where: {
                id,
                schoolId: req.user.schoolId
            }
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found."
            });
        }

        // Delete User (if exists)
        if (teacher.userId) {
            await prisma.user.delete({
                where: {
                    id: teacher.userId
                }
            });
        }

        // Delete Teacher
        await prisma.teacher.delete({
            where: {
                id
            }
        });

        return res.status(200).json({
            success: true,
            message: "Teacher deleted successfully."
        });

    } catch (error) {
        console.error("Delete Teacher Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// exports.assignTeacherSubject = async (req, res) => {
//     try {
//         const { teacherId } = req.params;
//         const { assignments } = req.body;
//         const schoolId = req.user.schoolId;

//         // Validate assignments
//         if (!Array.isArray(assignments) || assignments.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Assignments are required.",
//             });
//         }

//         // Check Teacher
//         const teacher = await prisma.teacher.findFirst({
//             where: {
//                 id: teacherId,
//                 schoolId,
//             },
//         });

//         if (!teacher) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Teacher not found.",
//             });
//         }

//         const teacherSubjectData = [];

//         // Validate & Prepare Data
//         for (const assignment of assignments) {
//             const { classId, sectionIds, subjectIds } = assignment;

//             if (
//                 !classId ||
//                 !Array.isArray(sectionIds) ||
//                 sectionIds.length === 0 ||
//                 !Array.isArray(subjectIds) ||
//                 subjectIds.length === 0
//             ) {
//                 return res.status(400).json({
//                     success: false,
//                     message:
//                         "Each assignment must contain classId, sectionIds and subjectIds.",
//                 });
//             }

//             // Validate Class
//             const existingClass = await prisma.class.findFirst({
//                 where: {
//                     id: classId,
//                     schoolId,
//                 },
//             });

//             if (!existingClass) {
//                 return res.status(404).json({
//                     success: false,
//                     message: `Class not found: ${classId}`,
//                 });
//             }

//             // Validate Sections
//             const sections = await prisma.section.findMany({
//                 where: {
//                     id: {
//                         in: sectionIds,
//                     },
//                     classId,
//                     schoolId,
//                 },
//                 select: {
//                     id: true,
//                 },
//             });

//             if (sections.length !== sectionIds.length) {
//                 return res.status(404).json({
//                     success: false,
//                     message:
//                         "One or more sections are invalid for the selected class.",
//                 });
//             }

//             // Validate Subjects
//             const subjects = await prisma.subject.findMany({
//                 where: {
//                     id: {
//                         in: subjectIds,
//                     },
//                     schoolId,
//                 },
//                 select: {
//                     id: true,
//                 },
//             });

//             if (subjects.length !== subjectIds.length) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "One or more subjects not found.",
//                 });
//             }

//             // Prepare Data
//             for (const sectionId of sectionIds) {
//                 for (const subjectId of subjectIds) {
//                     teacherSubjectData.push({
//                         schoolId,
//                         teacherId,
//                         classId,
//                         sectionId,
//                         subjectId,
//                     });
//                 }
//             }
//         }

//         // Save
//         await prisma.teacherSubject.createMany({
//             data: teacherSubjectData,
//             skipDuplicates: true,
//         });

//         // Fetch Assigned Subjects
//         const assignedSubjects = await prisma.teacherSubject.findMany({
//             where: {
//                 teacherId,
//                 schoolId,
//             },
//             include: {
//                 teacher: {
//                     select: {
//                         id: true,
//                         firstName: true,
//                         lastName: true,
//                     },
//                 },
//                 class: {
//                     select: {
//                         id: true,
//                         className: true,
//                     },
//                 },
//                 section: {
//                     select: {
//                         id: true,
//                         sectionName: true,
//                     },
//                 },
//                 subject: {
//                     select: {
//                         id: true,
//                         subjectName: true,
//                         shortName: true,
//                     },
//                 },
//             },
//             orderBy: [
//                 {
//                     class: {
//                         className: "asc",
//                     },
//                 },
//                 {
//                     section: {
//                         sectionName: "asc",
//                     },
//                 },
//                 {
//                     subject: {
//                         subjectName: "asc",
//                     },
//                 },
//             ],
//         });

//         return res.status(201).json({
//             success: true,
//             message: "Teacher subjects assigned successfully.",
//             totalAssigned: teacherSubjectData.length,
//             data: assignedSubjects,
//         });
//     } catch (error) {
//         console.error("Assign Teacher Subject Error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Internal Server Error",
//             error: error.message,
//         });
//     }
// };




exports.assignTeacherSubject = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { assignments } = req.body;
        const schoolId = req.user.schoolId;

        // Validate payload
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Assignments are required.",
            });
        }

        // Validate Teacher
        const teacher = await prisma.teacher.findFirst({
            where: {
                id: teacherId,
                schoolId,
            },
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: "Teacher not found.",
            });
        }

        const teacherSubjectData = [];

        for (const assignment of assignments) {
            const { classId, sections } = assignment;

            if (
                !classId ||
                !Array.isArray(sections) ||
                sections.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Each assignment must contain classId and sections.",
                });
            }

            // Validate Class
            const existingClass = await prisma.class.findFirst({
                where: {
                    id: classId,
                    schoolId,
                },
            });

            if (!existingClass) {
                return res.status(404).json({
                    success: false,
                    message: `Class not found.`,
                });
            }

            for (const section of sections) {
                const { sectionId, subjectIds } = section;

                if (
                    !sectionId ||
                    !Array.isArray(subjectIds) ||
                    subjectIds.length === 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Each section must contain sectionId and subjectIds.",
                    });
                }

                // Validate Section
                const existingSection = await prisma.section.findFirst({
                    where: {
                        id: sectionId,
                        classId,
                        schoolId,
                    },
                });

                if (!existingSection) {
                    return res.status(404).json({
                        success: false,
                        message: `Section not found.`,
                    });
                }

                // Remove duplicate subjectIds
                const uniqueSubjectIds = [...new Set(subjectIds)];

                // Validate Subjects
                const existingSubjects = await prisma.subject.findMany({
                    where: {
                        id: {
                            in: uniqueSubjectIds,
                        },
                        schoolId,
                    },
                    select: {
                        id: true,
                    },
                });

                if (existingSubjects.length !== uniqueSubjectIds.length) {
                    return res.status(404).json({
                        success: false,
                        message: "One or more subjects not found.",
                    });
                }

                uniqueSubjectIds.forEach((subjectId) => {
                    teacherSubjectData.push({
                        schoolId,
                        teacherId,
                        classId,
                        sectionId,
                        subjectId,
                    });
                });
            }
        }

        // Transaction
        await prisma.$transaction(async (tx) => {
            // Remove old assignments
            await tx.teacherSubject.deleteMany({
                where: {
                    teacherId,
                    schoolId,
                },
            });

            // Insert new assignments
            await tx.teacherSubject.createMany({
                data: teacherSubjectData,
            });
        });

        // Fetch latest assignments
        const assignedSubjects = await prisma.teacherSubject.findMany({
            where: {
                teacherId,
                schoolId,
            },
            include: {
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
                subject: {
                    select: {
                        id: true,
                        subjectName: true,
                        shortName: true,
                    },
                },
            },
            orderBy: [
                {
                    class: {
                        className: "asc",
                    },
                },
                {
                    section: {
                        sectionName: "asc",
                    },
                },
                {
                    subject: {
                        subjectName: "asc",
                    },
                },
            ],
        });

        // Group Response
        const assignmentMap = {};

        assignedSubjects.forEach((item) => {
            if (!assignmentMap[item.class.id]) {
                assignmentMap[item.class.id] = {
                    classId: item.class.id,
                    className: item.class.className,
                    sortName: item.class.sortName,
                    sections: {},
                };
            }

            if (!assignmentMap[item.class.id].sections[item.section.id]) {
                assignmentMap[item.class.id].sections[item.section.id] = {
                    sectionId: item.section.id,
                    sectionName: item.section.sectionName,
                    subjectIds: [],
                    subjects: [],
                };
            }

            assignmentMap[item.class.id].sections[item.section.id].subjectIds.push(
                item.subject.id
            );

            assignmentMap[item.class.id].sections[item.section.id].subjects.push({
                id: item.subject.id,
                subjectName: item.subject.subjectName,
                shortName: item.subject.shortName,
            });
        });

        const response = Object.values(assignmentMap).map((cls) => ({
            classId: cls.classId,
            className: cls.className,
            sortName: cls.sortName,
            sections: Object.values(cls.sections),
        }));

        return res.status(200).json({
            success: true,
            message: "Teacher subjects assigned successfully.",
            totalAssigned: teacherSubjectData.length,
            data: response,
        });

    } catch (error) {
        console.error("Assign Teacher Subject Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};