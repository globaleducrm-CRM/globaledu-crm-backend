const express = require('express');
const authorizeRoles = require('../../middlewares/role.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const sessionController = require('../../controllers/SCHOOL-ADMIN/session.controller');
const classController = require('../../controllers/SCHOOL-ADMIN/class.controller');
const sectionController = require('../../controllers/SCHOOL-ADMIN/section.controller');
const subjectController = require('../../controllers/SCHOOL-ADMIN/subject.controller');
const teacherController = require('../../controllers/SCHOOL-ADMIN/teacher.controller');

const router = express.Router();


// SESSION
router.post("/academic-session/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.store);

router.get("/academic-session",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.index);
router.put("/academic-session/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.update);
router.delete("/academic-session/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.delete);
router.patch("/academic-session/:id/set-current",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.status);

// CLASS
router.get("/classes",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.index);
router.get("/classes/session",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.sessionByShowClass);
router.post("/class/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.store);
router.put("/class/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.update);
router.delete("/class/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.delete);
router.patch("/class/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.status);


// SECTION
router.get("/sections",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.index);
router.post("/section/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.store);
router.put("/section/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.update);
router.patch("/section/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.status);
router.delete("/section/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.delete);


// SUBJECT
router.get("/subjects",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.index);
router.post("/subject/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.store);
router.patch("/subject/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.status);
router.put("/subject/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.update);
router.delete("/subject/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.delete);


// SUBJECT
router.get("/teachers",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.index);
router.post("/teacher/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.store);

module.exports = router;