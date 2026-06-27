const express = require("express");
const router = express.Router();

const upload = require('../../middlewares/upload')

const schoolController = require("../../controllers/super-admin/school.controller");
const roleController = require("../../controllers/role.controller");
const userController = require("../../controllers/super-admin/userController");
const authMiddleware = require("../../middlewares/auth.middleware");
const roleMiddleware = require("../../middlewares/role.middleware");



router.get('/roles',  authMiddleware, roleMiddleware("SUPER_ADMIN","SCHOOL_ADMIN"),roleController.index);

router.post('/roles/create',authMiddleware, roleMiddleware("SUPER_ADMIN","SCHOOL_ADMIN"), roleController.store);

// User All show
router.get("/all-users",authMiddleware,roleMiddleware("SUPER_ADMIN"),userController.index);

// School
router.get("/schools",authMiddleware,roleMiddleware("SUPER_ADMIN"),schoolController.index);

// SCHOOL CREATE
router.post("/school/create",authMiddleware,roleMiddleware("SUPER_ADMIN"),
upload.fields([{ name: "logo",  maxCount: 1,}, {  name: "banner",maxCount: 1, },]),schoolController.store);


// SCHOOL ADMIN CREATE
router.post(
    "/school-admin/create-school-approved",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    schoolController.createSchoolAdmin
);


// get Show School
router.get("/school/:id",authMiddleware,roleMiddleware("SUPER_ADMIN"),schoolController.show);

// School Update
router.put(
  "/school/:id",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  (req, res, next) => {
    console.log("BEFORE MULTER");
    next();
  },
  (req, res, next) => {
    upload.fields([
      { name: "logo", maxCount: 1 },
      { name: "banner", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).json({
          success: false,
          message: err.message,
          error: err,
        });
      }

      console.log("AFTER MULTER");
      next();
    });
  },
  schoolController.update
);

// Status School
router.patch("/school/:id/status",authMiddleware,roleMiddleware("SUPER_ADMIN"),schoolController.status);

// Delete School
router.delete("/school/:id",authMiddleware,roleMiddleware("SUPER_ADMIN"),schoolController.delete);

module.exports = router;