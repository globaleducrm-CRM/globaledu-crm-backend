const emailTemplate = (adminName, schoolName, email, password) => {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Welcome</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="background:#ffffff;margin:30px auto;border-radius:10px;overflow:hidden;">

<tr>
<td style="background:#dc2626;color:#fff;padding:20px;text-align:center;">
<h2 style="margin:0;">GlobalEdu CRM</h2>
</td>
</tr>

<tr>
<td style="padding:30px;">

<h3>Hello ${adminName},</h3>

<p>Your School Admin account has been created successfully.</p>

<table width="100%" cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse;">
<tr>
<td><strong>School</strong></td>
<td>${schoolName}</td>
</tr>

<tr>
<td><strong>Email</strong></td>
<td>${email}</td>
</tr>

<tr>
<td><strong>Password</strong></td>
<td>${password}</td>
</tr>
</table>

<p style="margin-top:25px;">
<a href="http://localhost:5173/login"
style="background:#dc2626;color:#fff;padding:12px 25px;text-decoration:none;border-radius:6px;">
Login Now
</a>
</p>

<p>
Please change your password after your first login.
</p>

</td>
</tr>

<tr>
<td style="background:#f8f8f8;padding:15px;text-align:center;font-size:12px;color:#777;">
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
};

module.exports = emailTemplate;