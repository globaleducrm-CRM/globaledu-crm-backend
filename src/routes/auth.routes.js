const express = require('express')


const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middlewares/auth.middleware')
const roleMiddleware = require('../middlewares/role.middleware')


const router = express.Router();


// router.post('/register',authMiddleware,roleMiddleware("SUPER_ADMIN"),  authController.register);
router.post('/register',  authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware,authController.getProfile);

router.post("/forgot-password", authController.forgotPassword);
router.post("/change-password",authMiddleware, authController.changePassword);

router.post("/reset-password/:token", authController.resetPassword);

module.exports = router;