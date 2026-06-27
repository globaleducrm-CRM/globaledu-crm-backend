const { PrismaClient } = require('@prisma/client')
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendMail = require("../../utils/sendMail");
const emailTemplate = require("../../utils/emailTemplate");

const prisma = new PrismaClient();


exports.index = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;



        const search = req.query.search?.trim() || "";
        const status = req.query.status || "";
        const board = req.query.board || "";
        const date = req.query.date || "";

        const fromDate = req.query.fromDate;
        const toDate = req.query.toDate;

        const skip = (page - 1) * limit;

        const where = {};

        // Search
        if (search) {
            where.OR = [
                {
                    name: {
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
                    phone: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    city: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    state: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        // Status
        if (status) {
            where.status = status;
        }

        // Board
        if (board) {
            where.board = board;
        }

        // Date Filter
        if (date) {

            const today = new Date();

            if (date === "today") {

                const start = new Date();
                start.setHours(0, 0, 0, 0);

                const end = new Date();
                end.setHours(23, 59, 59, 999);

                where.createdAt = {
                    gte: start,
                    lte: end,
                };
            }

            else if (date === "yesterday") {

                const start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);

                const end = new Date();
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);

                where.createdAt = {
                    gte: start,
                    lte: end,
                };
            }

            else if (date === "custom" && fromDate && toDate) {

                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);

                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);

                where.createdAt = {
                    gte: start,
                    lte: end,
                };
            }
        }

        const [schools, totalSchools] = await Promise.all([
            prisma.school.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
            }),

            prisma.school.count({
                where,
            }),
        ]);


        const totalPages = Math.ceil(totalSchools / limit);

        return res.status(200).json({
            success: true,
            message: "Schools fetched successfully.",
            data: schools,



            pagination: {
                currentPage: page,
                perPage: limit,
                totalRecords: totalSchools,
                totalPages,

                hasPreviousPage: page > 1,
                hasNextPage: page < totalPages,

                prevPage: page > 1 ? page - 1 : null,
                nextPage: page < totalPages ? page + 1 : null,
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

exports.store = async (req, res) => {
    try {

        const {
            name,
            schoolCode,
            schoolBoardCode,
            board,
            status,
            affiliationNo,
            email,
            phone,
            website,
            addressLine,
            city,
            district,
            state,
            country,
            pincode,
            principalName,
            principalEmail,
            principalPhone,
            ownerName,
            ownerEmail,
            ownerPhone,
            adminName,
            adminEmail,
            adminPhone,
        } = req.body;



        // Validation
        if (
            !name ||
            !schoolCode ||
            !email ||
            !phone ||
            !addressLine ||
            !country ||
            !state ||
            !city ||
            !district
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields.",
            });
        }

        // Files
        const logo = req.files?.logo?.[0]?.path || null;
        const banner = req.files?.banner?.[0]?.path || null;



        // Duplicate School Code
        const schoolExists = await prisma.school.findUnique({
            where: {
                schoolCode,
            },
        });

        if (schoolExists) {
            return res.status(400).json({
                success: false,
                message: "School code already exists.",
            });
        }

        // Create School
        const school = await prisma.school.create({
            data: {
                name,
                schoolCode,
                schoolBoardCode,
                board,
                status,
                affiliationNo,
                email,
                phone,
                website,
                logo,
                banner,
                addressLine,
                city,
                district,
                state,
                country,
                pincode,
                principalName,
                principalEmail,
                principalPhone,
                ownerName,
                ownerEmail,
                ownerPhone,
                adminName,
                adminEmail,
                adminPhone,
            },
        });

        return res.status(201).json({
            success: true,
            message: "School created successfully.",
            data: school,
        });

    } catch (error) {
        console.error("ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack,
        });
    }
};

exports.createSchoolAdmin = async (req, res) => {
    try {

        const {
            schoolId,
            name,
            email,
            mobile,
        } = req.body;


        // Validation
        if (!schoolId || !name || !email || !mobile) {
            return res.status(400).json({
                success: false,
                message: "School Id, Name, Email and Mobile are required."
            });
        }

        // Check School
        const school = await prisma.school.findUnique({
            where: {
                id: schoolId
            }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        // Get School Admin Role
        const role = await prisma.role.findUnique({
            where: {
                name: "SCHOOL_ADMIN"
            }
        });

        if (!role) {
            return res.status(404).json({
                success: false,
                message: "SCHOOL_ADMIN role not found."
            });
        }

        // Check Email
        const existingUser = await prisma.user.findUnique({
            where: {
                email
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already exists."
            });
        }

        // Generate Password
        const plainPassword = crypto
            .randomBytes(8)
            .toString("base64")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 10);

        console.log("plainPassword", plainPassword)

        // Hash Password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);



        // Send Email
        const info = await sendMail({
            to: email,
            subject: "Welcome To GlobalEdu CRM",
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

<h2 style="margin-top:0;">Welcome ${name} 👋</h2>

<p>
Your School Admin account has been created successfully.
</p>

<table width="100%" cellpadding="10" cellspacing="0"
style="border-collapse:collapse;border:1px solid #ddd;margin-top:20px;">

<tr>
<td style="font-weight:bold;background:#fafafa;">School Name</td>
<td>${school.name}</td>
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
<a href="http://localhost:5173/login"
style="
background:#dc2626;
color:#fff;
padding:14px 35px;
text-decoration:none;
border-radius:6px;
display:inline-block;
font-weight:bold;
">
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




        console.log(name);
        console.log(school.name);
        console.log(email);
        console.log(plainPassword);

        // Update School Status
        await prisma.school.update({
            where: {
                id: schoolId,
            },
            data: {
                status: "APPROVED",
            },
        });

        // Create User
        const user = await prisma.user.create({
            data: {
                schoolId,
                roleId: role.id,
                name,
                email,
                mobile,
                password: hashedPassword,
                isActive: true
            }
        });

        // Remove Password
        delete user.password;

        return res.status(201).json({
            success: true,
            message: "School Admin created successfully.",
            data: user
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });

    }
};

exports.show = async (req, res) => {
    try {
        const { id } = req.params;

        const school = await prisma.school.findUnique({
            where: {
                id: id,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "School fetched successfully",
            data: school,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.update = async (req, res) => {
    try {
        console.log("UPDATE API HIT");
        const { id } = req.params;

        console.log("Headers:", req.headers["content-type"]);
        console.log("Body:", req.body);
        console.log("Files:", req.files);
        console.log("ID:", id);

        const school = await prisma.school.findUnique({
            where: { id }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        // Files
        const logo = req.files?.logo?.[0]?.path || null;
        const banner = req.files?.banner?.[0]?.path || null;




        const updatedSchool = await prisma.school.update({
            where: {
                id
            },
            data: {
                name: req.body.name,
                schoolCode: req.body.schoolCode,

                board: req.body.board,
                schoolBoardCode: req.body.schoolBoardCode,
                affiliationNo: req.body.affiliationNo,

                email: req.body.email,
                phone: req.body.phone,
                website: req.body.website,

                addressLine: req.body.addressLine,
                country: req.body.country,
                state: req.body.state,
                district: req.body.district,
                city: req.body.city,
                pincode: req.body.pincode,

                principalName: req.body.principalName,
                principalEmail: req.body.principalEmail,
                principalPhone: req.body.principalPhone,

                ownerName: req.body.ownerName,
                ownerEmail: req.body.ownerEmail,
                ownerPhone: req.body.ownerPhone,

                adminName: req.body.adminName,
                adminEmail: req.body.adminEmail,
                adminPhone: req.body.adminPhone,

                status: req.body.status,

                // Update only if new image uploaded
                logo: logo || school.logo,
                banner: banner || school.banner
            }
        });

        return res.status(200).json({
            success: true,
            message: "School updated successfully.",
            data: updatedSchool
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });

    }
};

exports.status = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const school = await prisma.school.findUnique({
            where: {
                id,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found",
            });
        }

        // Decide user active status
        let isActive = false;

        if (status === "APPROVED") {
            isActive = true;
        }

        const updatedSchool = await prisma.school.update({
            where: {
                id,
            },
            data: {
                status,
            },
        });

        // Update all users of this school
        await prisma.user.updateMany({
            where: {
                schoolId: id,
            },
            data: {
                isActive,
            },
        });

        return res.status(200).json({
            success: true,
            message: "School status updated successfully",
            data: updatedSchool,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.delete = async (req, res) => {
    try {

        const { id } = req.params;

        const school = await prisma.school.findUnique({
            where: {
                id
            }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        await prisma.school.delete({
            where: {
                id
            }
        });

        return res.status(200).json({
            success: true,
            message: "School deleted successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });

    }
};