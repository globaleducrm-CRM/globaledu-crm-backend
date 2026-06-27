const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const sendEmail = require("../utils/sendMail");
const crypto = require("crypto");

const prisma = new PrismaClient();

exports.register = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        console.log("register data:", name, email, mobile, password);

        // Validation
        if (!name || !email || !mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "All required fields are mandatory."
            });
        }

        // Check existing user
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already exists."
            });
        }

        // Default role fetch
        const role = await prisma.role.findUnique({
            where: { name: "SUPER_ADMIN" }
        });

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Default role not found."
            });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User
        const user = await prisma.user.create({
            data: {
                name,
                email,
                mobile,
                password: hashedPassword,
                roleId: role.id,
            },
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        return res.status(201).json({
            success: true,
            message: "User registered successfully.",
            data: userWithoutPassword
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
// create register
// exports.register = async (req, res) => {
//     try {

//         const {
//             name,
//             email,
//             mobile,
//             password,
//             role: roleName,
//             schoolId
//         } = req.body;

//         if (!name || !email || !mobile || !password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All fields are required."
//             });
//         }

//         // CHECK TOTAL USERS

//         const totalUsers = await prisma.user.count();

//         // FIRST USER => SUPER_ADMIN

//         if (totalUsers === 0) {

//             const superAdminRole = await prisma.role.findUnique({
//                 where: {
//                     name: "SUPER_ADMIN"
//                 }
//             });

//             if (!superAdminRole) {
//                 return res.status(404).json({
//                     success: false,
//                     message: "SUPER_ADMIN role not found."
//                 });
//             }

//             const hashPassword = await bcrypt.hash(password, 10);

//             const user = await prisma.user.create({
//                 data: {
//                     name,
//                     email,
//                     mobile,
//                     password: hashPassword,
//                     roleId: superAdminRole.id
//                 },
//                 include: {
//                     role: true
//                 }
//             });

//             const { password: _, roleId, ...userData } = user;

//             return res.status(201).json({
//                 success: true,
//                 message: "SUPER_ADMIN created successfully.",
//                 data: userData
//             });
//         }

//         // LOGIN REQUIRED

//         if (!req.user) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Unauthorized."
//             });
//         }

//         const loggedUser = req.user;

//         const ROLE_HIERARCHY = {
//             SUPER_ADMIN: [
//                 "SCHOOL_ADMIN"
//             ],

//             SCHOOL_ADMIN: [
//                 "TEACHER",
//                 "STUDENT",
//                 "PARENT",
//                 "ACCOUNTANT",
//                 "LIBRARIAN"
//             ]
//         };

//         if (!roleName) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Role is required."
//             });
//         }

//         // ROLE CHECK

//         if (!ROLE_HIERARCHY[loggedUser.role.name]?.includes(roleName)) {
//             return res.status(403).json({
//                 success: false,
//                 message: `You cannot create ${roleName}.`
//             });
//         }

//         // FIND ROLE

//         const role = await prisma.role.findUnique({
//             where: {
//                 name: roleName
//             }
//         });

//         if (!role) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Role not found."
//             });
//         }

//         // EMAIL EXISTS

//         const userExists = await prisma.user.findFirst({
//             where: {
//                 OR: [
//                     {
//                         email
//                     },
//                     {
//                         mobile
//                     }
//                 ]
//             }
//         });

//         if (userExists) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Email or Mobile already exists."
//             });
//         }

//         let assignSchoolId = null;     

//         // SUPER_ADMIN

//         if (loggedUser.role.name === "SUPER_ADMIN") {

//             if (roleName === "SCHOOL_ADMIN") {

//                 if (!schoolId) {
//                     return res.status(400).json({
//                         success: false,
//                         message: "School ID is required."
//                     });
//                 }

//                 const school = await prisma.school.findUnique({
//                     where: {
//                         id: schoolId
//                     }
//                 });

//                 if (!school) {
//                     return res.status(404).json({
//                         success: false,
//                         message: "School not found."
//                     });
//                 }

//                 assignSchoolId = school.id;

//             }

//         }

//         // SCHOOL_ADMIN

//         if (loggedUser.role.name === "SCHOOL_ADMIN") {

//             if (!loggedUser.schoolId) {
//                 return res.status(403).json({
//                     success: false,
//                     message: "School is not assigned."
//                 });
//             }

//             assignSchoolId = loggedUser.schoolId;

//         }

//         // HASH PASSWORD

//         const hashPassword = await bcrypt.hash(password, 10);

//         // CREATE USER

//         const user = await prisma.user.create({

//             data: {
//                 name,
//                 email,
//                 mobile,
//                 password: hashPassword,
//                 roleId: role.id,
//                 schoolId: assignSchoolId
//             },

//             include: {

//                 role: {
//                     select: {
//                         id: true,
//                         name: true
//                     }
//                 },

//                 school: {
//                     select: {
//                         id: true,
//                         name: true
//                     }
//                 }

//             }

//         });

//         const { password: _, roleId, ...userData } = user;

//         return res.status(201).json({
//             success: true,
//             message: `${role.name} created successfully.`,
//             data: userData
//         });

//     } catch (error) {

//         console.log(error);

//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });

//     }
// };

// exports.register = async (req, res) => {
//     try {
//         const { name, email, mobile, password } = req.body;

//         console.log('Request Body:', req.body); // Log the request body for debugging

//         if (!name || !email || !mobile || !password) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'All fields are required'
//             });
//         }

//         // Find SUPER_ADMIN role
//         const role = await prisma.role.findUnique({
//             where: {
//                 name: "SUPER_ADMIN",
//             },
//         });

//         if (!role) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'SUPER_ADMIN role not found'
//             });
//         }

//         const userExists = await prisma.user.findUnique({
//             where: {
//                 email: email,
//             },
//         });

//         if (userExists) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'User with this email already exists'
//             });

//         }

//         const hashPassword = await bcrypt.hash(password, 10);

//         const user = await prisma.user.create({
//             data: {
//                 name,
//                 email,
//                 mobile,
//                 password: hashPassword,
//                 roleId: role.id
//             },
//             include: {
//                 role: true,
//             },
//         });
//         return res.status(201).json({
//             success: true,
//             message: `${role.name} created successfully`,
//             data: user
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Internal server error'
//         });
//     }
// }

// Login User
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Optional: Check if account is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive. Please contact administrator.",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }


        const token = generateToken(user.id, user.role.name);

        // Remove sensitive fields
        const { password: _, roleId, ...userData } = user;

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: userData,
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

// profile user
exports.getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                school: {
                    select: {
                        id: true,
                        name: true,
                        schoolCode: true,
                        logo:true
                    },
                },
            },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }

        // Hide sensitive fields
        const { password, roleId, ...userData } = user;

        return res.status(200).json({
            success: true,
            data: userData
        })


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}



exports.forgotPassword = async (req, res) => {
    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");

        const expire = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpire: expire
            }
        });

        console.log(process.env.FRONTEND_URL)

        const resetLink =
            `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await sendEmail({
            to: user.email,
            subject: "Reset Password",
            html: `
                <h2>Password Reset</h2>

                <p>Click below link to reset password.</p>

                <a href="${resetLink}">
                    Reset Password
                </a>

                <p>This link expires in 15 minutes.</p>
            `
        });

        return res.json({
            success: true,
            message: "Password reset link sent successfully."
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


exports.resetPassword = async (req, res) => {

    try {

        const { token } = req.params;

        const { password } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpire: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpire: null
            }
        });

        return res.json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const isMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        // Optional: Prevent using the same password
        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from current password",
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: {
                id: req.user.id,
            },
            data: {
                password: hashedPassword,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};