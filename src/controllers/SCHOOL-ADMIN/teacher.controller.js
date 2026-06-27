const { PrismaClient } = require('@prisma/client');
const { sendMail } = require('../../config/mail');
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = req.query.search?.trim();

        const where = {
            schoolId: req.user.schoolId,

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
                status: true,
                createdAt: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Teachers fetched successfully.",
            data: teachers,
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
        } = req.body;

        // ✅ Validation
        if (!employeeId?.trim() || !firstName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and First Name are required.",
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
            where: {
                id: req.user.schoolId
            }
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

            return res.status(409).json({
                success: false,
                message,
            });
        }

        // ✅ Get TEACHER Role
        const role = await prisma.role.findUnique({
            where: {
                name: "TEACHER"
            }
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
                where: {
                    email: email
                }
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
                where: {
                    mobile: mobile
                }
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

        // ✅ Hash Password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // ✅ Create User
        const user = await prisma.user.create({
            data: {
                schoolId: req.user.schoolId,
                roleId: role.id,
                name: `${firstName} ${lastName || ''}`.trim(),
                email: email,
                mobile: mobile,
                password: hashedPassword,
                isActive: true
            }
        });

        // ✅ Create Teacher
        const teacher = await prisma.teacher.create({
            data: {
                schoolId: req.user.schoolId,
                userId: user.id,
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
                isActive: true
            }
        });

        // ✅ Send Email (with correct variables)
        try {
            if (email) {
                await sendMail({
                    to: email,
                    subject: "Welcome To GlobalEdu CRM - Teacher Account Created",
                    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
            <td align="center">
                <table width="650" cellpadding="0" cellspacing="0"
                    style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1);">
                    <tr>
                        <td style="background:#dc2626;padding:25px;text-align:center;color:#fff;">
                            <h1 style="margin:0;">GlobalEdu CRM</h1>
                            <p style="margin-top:8px;">School Management System</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:35px;">
                            <h2 style="margin-top:0;">Welcome ${firstName} ${lastName || ''} 👋</h2>
                            <p>Your Teacher account has been created successfully.</p>
                            <table width="100%" cellpadding="10" cellspacing="0"
                                style="border-collapse:collapse;border:1px solid #ddd;margin-top:20px;">
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">School Name</td>
                                    <td>${school.name}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Employee ID</td>
                                    <td>${employeeId}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Email</td>
                                    <td>${email}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Password</td>
                                    <td>${plainPassword}</td>
                                </tr>
                            </table>
                            <div style="text-align:center;margin:35px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                                    style="background:#dc2626;color:#fff;padding:14px 35px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
                                    Login Now
                                </a>
                            </div>
                            <p style="color:#555;">
                                For security reasons, please change your password after your first login.
                            </p>
                            <p>
                                Regards,<br>
                                <b>GlobalEdu CRM Team</b>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#f8f8f8;padding:18px;text-align:center;font-size:12px;color:#777;">
                            © ${new Date().getFullYear()} GlobalEdu CRM. All Rights Reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
                    `
                });
                console.log("Email sent successfully to:", email);
            }
        } catch (emailError) {
            console.error("Email sending failed:", emailError.message);
            // Don't fail the request if email fails
        }

        // ✅ Remove password from response
        const userResponse = { ...user };
        delete userResponse.password;

        return res.status(201).json({
            success: true,
            message: "Teacher created successfully. Login credentials sent to email.",
            data: {
                teacher: teacher,
                user: userResponse
            }
        });

    } catch (error) {
        console.error("Store Teacher Error:", error);

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