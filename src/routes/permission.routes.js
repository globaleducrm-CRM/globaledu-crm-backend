const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permission.controller');

router.get('/', permissionController.index);
router.post('/create', permissionController.store);

module.exports = router;