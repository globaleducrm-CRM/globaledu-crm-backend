// utils/emailHelpers.js
const nodemailer = require("nodemailer");

// Create transporter here directly
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection
transporter.verify()
    .then(() => console.log("SMTP Connected"))
    .catch(console.error);

// Direct sendMail function
const sendMail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: html
        });
        console.log('✅ Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        throw error;
    }
};

const sendStudentWelcomeEmail = async (studentName, email, password, admissionNo, fatherName, motherName, schoolName) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to GlobalEdu CRM</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
            <td align="center">
                <table width="650" cellpadding="0" cellspacing="0"
                    style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1);">
                    <tr>
                        <td style="background:#7c3aed;padding:25px;text-align:center;color:#fff;">
                            <h1 style="margin:0;">GlobalEdu CRM</h1>
                            <p style="margin-top:8px;">${schoolName}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:35px;">
                            <h2 style="margin-top:0;">Welcome ${studentName} 🎓</h2>
                            <p>Your student account has been created successfully!</p>
                            
                            <table width="100%" cellpadding="10" cellspacing="0"
                                style="border-collapse:collapse;border:1px solid #ddd;margin-top:20px;">
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Student Name</td>
                                    <td>${studentName}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Admission No</td>
                                    <td>${admissionNo}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Email</td>
                                    <td>${email}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Password</td>
                                    <td><strong>${password}</strong></td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Father's Name</td>
                                    <td>${fatherName}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Mother's Name</td>
                                    <td>${motherName}</td>
                                </tr>
                            </table>

                            <div style="text-align:center;margin:35px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                                    style="background:#7c3aed;color:#fff;padding:14px 35px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
                                    Login to Dashboard
                                </a>
                            </div>

                            <p style="color:#555;font-size:14px;">
                                <strong>Important:</strong> Please change your password after your first login.
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
    `;

    return await sendMail({ to: email, subject: 'Welcome to GlobalEdu CRM - Student Account', html });
};

const sendParentWelcomeEmail = async (parentName, email, password, relationship, studentName, admissionNo, schoolName) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to GlobalEdu CRM</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
            <td align="center">
                <table width="650" cellpadding="0" cellspacing="0"
                    style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1);">
                    <tr>
                        <td style="background:#7c3aed;padding:25px;text-align:center;color:#fff;">
                            <h1 style="margin:0;">GlobalEdu CRM</h1>
                            <p style="margin-top:8px;">${schoolName}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:35px;">
                            <h2 style="margin-top:0;">Welcome ${parentName} 👋</h2>
                            <p>Your ${relationship} account has been created successfully.</p>
                            
                            <table width="100%" cellpadding="10" cellspacing="0"
                                style="border-collapse:collapse;border:1px solid #ddd;margin-top:20px;">
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Child's Name</td>
                                    <td>${studentName}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Admission No</td>
                                    <td>${admissionNo}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Relationship</td>
                                    <td>${relationship}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Email</td>
                                    <td>${email}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight:bold;background:#fafafa;">Password</td>
                                    <td><strong>${password}</strong></td>
                                </tr>
                            </table>

                            <div style="text-align:center;margin:35px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                                    style="background:#7c3aed;color:#fff;padding:14px 35px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
                                    Login to Dashboard
                                </a>
                            </div>

                            <p style="color:#555;font-size:14px;">
                                <strong>Features available to you:</strong><br>
                                ✅ Track your child's academic progress<br>
                                ✅ View attendance and report cards<br>
                                ✅ Pay fees online<br>
                                ✅ Communicate with teachers<br>
                            </p>

                            <p style="color:#555;">
                                <strong>Important:</strong> Please change your password after your first login.
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
    `;

    return await sendMail({ to: email, subject: `Welcome to GlobalEdu CRM - ${relationship} Account`, html });
};

module.exports = {
    sendStudentWelcomeEmail,
    sendParentWelcomeEmail
};