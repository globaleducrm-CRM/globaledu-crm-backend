const express = require('express');
const authorizeRoles = require('../../middlewares/role.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const sessionController = require('../../controllers/SCHOOL-ADMIN/session.controller');
const classController = require('../../controllers/SCHOOL-ADMIN/class.controller');
const sectionController = require('../../controllers/SCHOOL-ADMIN/section.controller');
const subjectController = require('../../controllers/SCHOOL-ADMIN/subject.controller');
const teacherController = require('../../controllers/SCHOOL-ADMIN/teacher.controller');
const studentController = require('../../controllers/SCHOOL-ADMIN/student.controller');
const timeTableController = require('../../controllers/SCHOOL-ADMIN/timetable.Controller');
const timetablereportController = require('../../controllers/SCHOOL-ADMIN/timetablereport.controller');
const feesHeadController = require('../../controllers/SCHOOL-ADMIN/feesHead.controller');
const feeStructureController = require('../../controllers/SCHOOL-ADMIN/feeStructure.controller');
const invoiceFeeController = require('../../controllers/SCHOOL-ADMIN/invoiceFee.controller');
const feePaymentController = require('../../controllers/SCHOOL-ADMIN/feePayment.controller');
const feeReceiptController = require('../../controllers/SCHOOL-ADMIN/feeReceipt.controller');
const studentIdCardController = require('../../controllers/SCHOOL-ADMIN/studentIdCard.controller');
const upload = require('../../middlewares/upload');

const router = express.Router();


// SESSION
router.post("/academic-session/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.store);

router.get("/academic-session",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.index);
router.put("/academic-session/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.update);
router.delete("/academic-session/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.delete);
router.patch("/academic-session/:id/set-current",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sessionController.status);

// CLASS
router.get("/classes",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.index);
router.get("/classes/all-classes",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.getAllClass);
router.post("/class/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.store);
router.put("/class/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.update);
router.delete("/class/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.delete);
router.patch("/class/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),classController.status);


// SECTION
router.get("/sections",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.index);
router.get("/sections/all-sections",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.getAllSection);
router.post("/section/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.store);
router.get("/section/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.show);
router.get("/section/:sectionId/students",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.getStudentBySection);
router.put("/section/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.update);
router.patch("/section/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.status);
router.delete("/section/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),sectionController.delete);


// SUBJECT
router.get("/subjects",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.index);
router.get("/subjects/all-subjects",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.getAllSubjects);
router.post("/subject/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.store);
router.patch("/subject/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.status);
router.put("/subject/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.update);
router.get("/subject/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.show);
router.delete("/subject/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),subjectController.delete);


// TEACHER
router.get("/employees",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.index);
router.get("/teachers",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.teacherIndex);
router.get("/teacher-subjects",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.getTeachersClassIdOrSectionId);
router.get("/teachers/all-teachers",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.getallTeacher);
router.post("/employee/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.store);
router.patch("/employee/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.status);
router.get("/employee/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.show);
router.delete("/employee/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.delete);
router.put("/employee/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),upload.single('image'),teacherController.update);
router.put("/teacher-subject/:teacherId",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),teacherController.assignTeacherSubject);


// timeTable
router.get("/timetables",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.index);
router.get("/timetables/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.show);
router.patch("/timetables/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.status);
router.patch("/timetables/:timetableId/periods/:periodId/periodMasterId/:periodMasterId/break",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.toggleBreakStatus);
router.put("/timetables/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.updateTimetable);
router.post("/timetables/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timeTableController.createTimetable);


// timeTable
router.get("/timetable-report/report",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),timetablereportController.index);


// STUDENT
router.get("/students/generate-admission-no",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.generateAdmissionNo);
router.post("/students/create",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.store);
router.post("/students/promote",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.promotion);
router.get("/students",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.index);
// router.get("/students/history",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.studentHistory);
router.get("/transfer-certificates/history",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.transferCertificateHistory);
router.get("/students/:studentId/enrollment-history",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),
studentController.studentEnrollmentHistory);
router.get("/students/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.show);
router.patch("/students/:id/status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.status);

// parent status
router.patch("/students/:id/parent-status",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),studentController.parentStatus);
router.put("/students/:id",authMiddleware,authorizeRoles("SCHOOL_ADMIN"),upload.single('image'),
studentController.update);

// ✅ Transfer Certificate Routes
router.get( "/students/:studentId/tc", authMiddleware, authorizeRoles("SCHOOL_ADMIN"), studentController.getTC);

router.post("/students/:studentId/tc-download", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),  studentController.tcDownload);
router.post("/students/:studentId/transfer", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),  studentController.transferStudent);



// feesHeadController

router.get('/fees-head',authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feesHeadController.index)
router.post('/fees-head',authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feesHeadController.store)
router.put('/fees-head/:id',authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feesHeadController.edit)
router.delete('/fees-head/:id',authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feesHeadController.delete)


// feesStructureController

router.get("/fee-structures/sessionId/:sessionId/classId/:classId/sectionId/:sectionId",authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feeStructureController.loadFeeStructure)
router.post("/fee-structures",authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feeStructureController.saveFeeStructure )
router.post("/student-fee-override", authMiddleware, authorizeRoles("SCHOOL_ADMIN"), feeStructureController.saveStudentFeeOverride);


// invoiceFeeController
router.post('/invoices/generate', authMiddleware,authorizeRoles('SCHOOL_ADMIN'),invoiceFeeController.generateFeeInvoice)
router.get("/fee-invoices", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),invoiceFeeController.index);
router.get("/fee-invoices/:id", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),invoiceFeeController.show);
router.get("/fee-invoices/student/:studentId", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),invoiceFeeController.getStudentFeeInvoices);
router.get('/fee-invoices/:id/receipt', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), feeReceiptController.downloadReceipt);
router.put("/fee-invoices/:id", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),invoiceFeeController.update);
router.get("/download-fee-invoices", authMiddleware, authorizeRoles("SCHOOL_ADMIN"),invoiceFeeController.downloadInvoices);
// Fee Payments
router.post('/fee-payments', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), feePaymentController.store);
router.get('/fee-payments', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), feePaymentController.index);


// feeReceiptController
router.get('/fee-receipts/student/:studentId', authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feeReceiptController.receipts)
router.patch(
    "/fee-invoices/:invoiceId/repair-half-yearly",
    authMiddleware,
    authorizeRoles("SCHOOL_ADMIN"),
    feeReceiptController.repairHalfYearlyInvoice
);
router.get('/fee-receipts/:paymentId/download', authMiddleware,authorizeRoles('SCHOOL_ADMIN'),feeReceiptController.downloadFeeReceiptPDF)


// studentCrad Id
router.post('/student-id-card-templates', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.createStudentIdCardTemplate);
router.get('/student-id-card-templates', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.getStudentIdCardTemplates);
router.patch('/student-id-card-templates/:id/status', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.status);
router.put('/student-id-card-templates/:id', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.saveUpdateTemplate);
router.get('/student-id-cards/students', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.getStudentsForIdCard);
router.post('/student-id-cards/generate', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.generateStudentIdCards);
router.post('/student-id-card-templates/create-defaults', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.createDefaultIdCardTemplates );
router.post('/student-id-cards/generate-pdf', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.generateStudentIdCardsPdf );
router.get('/selectTemplete', authMiddleware, authorizeRoles('SCHOOL_ADMIN'), studentIdCardController.getTempleteStatusTrue  );
module.exports = router;