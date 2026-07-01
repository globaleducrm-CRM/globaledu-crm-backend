// const transporter = require("../config/mail");

// const sendMail = async ({ to, subject, html }) => {
//     await transporter.sendMail({
//         from: `"GlobalEdu CRM" <${process.env.EMAIL_USER}>`,
//         to,
//         subject,
//         html,
//     });
// };

// module.exports = sendMail;


const transporter = require("../config/mail");

const sendMail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `"GlobalEdu CRM" <${process.env.EMAIL_USER}>`,
            to,
            subject,    
            html,
        });

        console.log("Mail Sent:", info);

        return info;
    } catch (error) {
        console.log("Mail Error:", error);
        throw error;
    }
};

module.exports = sendMail;