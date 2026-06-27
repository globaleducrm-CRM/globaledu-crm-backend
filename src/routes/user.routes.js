const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

router.get('/profile-user', userController.index);



module.exports = router;