const jwt = require('jsonwebtoken');

const generateToken = (userId, roleName) => {
     
    return jwt.sign(
        {
            id: userId,
            role: roleName,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}   
module.exports = generateToken;