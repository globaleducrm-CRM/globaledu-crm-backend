const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

router.get('/',  authMiddleware, roleMiddleware("SUPER_ADMIN","SCHOOL_ADMIN"),roleController.index);

router.post('/create',authMiddleware, roleMiddleware("SUPER_ADMIN","SCHOOL_ADMIN"), roleController.store);

module.exports = router;