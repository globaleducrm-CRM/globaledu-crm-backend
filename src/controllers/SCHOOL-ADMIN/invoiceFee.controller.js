const { Prisma } = require("@prisma/client");
const prisma = require("../../config/prisma");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// ==========================================
// Helper: invoice date range se months nikale
// ==========================================
// ==========================================
// Get invoice months from date range
// ==========================================
const getInvoiceMonths = (dateFrom, dateTo) => {
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);

    if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
    ) {
        return [];
    }

    const months = [];

    const currentDate = new Date(
        Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            1
        )
    );

    const lastDate = new Date(
        Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            1
        )
    );

    while (currentDate <= lastDate) {
        months.push(
            currentDate.toLocaleString("en-US", {
                month: "long",
                timeZone: "UTC",
            })
        );

        currentDate.setUTCMonth(
            currentDate.getUTCMonth() + 1
        );
    }

    return months;
};


// ==========================================
// Generate Fee Invoices
// ==========================================
exports.generateFeeInvoice = async (req, res) => {
    try {
        const {
            sessionId,
            classId,
            sectionId,
            invoiceName,
            dateFrom,
            dateTo,
            dueDate,
        } = req.body;

        const schoolId = req.user.schoolId;

        // ==========================================
        // Required validation
        // ==========================================
        if (
            !sessionId ||
            !classId ||
            !sectionId ||
            !invoiceName?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Session, Class, Section and Invoice Name are required.",
            });
        }

        if (!dateFrom || !dateTo || !dueDate) {
            return res.status(400).json({
                success: false,
                message:
                    "Date From, Date To and Due Date are required.",
            });
        }

        const cleanInvoiceName = invoiceName.trim();

        // ==========================================
        // Parse and validate dates
        // ==========================================
        const parsedDateFrom = new Date(dateFrom);
        const parsedDateTo = new Date(dateTo);
        const parsedDueDate = new Date(dueDate);

        if (
            Number.isNaN(parsedDateFrom.getTime()) ||
            Number.isNaN(parsedDateTo.getTime()) ||
            Number.isNaN(parsedDueDate.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid dates.",
            });
        }

        if (parsedDateFrom > parsedDateTo) {
            return res.status(400).json({
                success: false,
                message:
                    "Date From cannot be greater than Date To.",
            });
        }

        // Due date should normally not be before period start
        if (parsedDueDate < parsedDateFrom) {
            return res.status(400).json({
                success: false,
                message:
                    "Due Date cannot be earlier than Date From.",
            });
        }

        // ==========================================
        // Validate session
        // ==========================================
        const session =
            await prisma.academicSession.findFirst({
                where: {
                    id: sessionId,
                    schoolId,
                },
                select: {
                    id: true,
                    sessionName: true,
                },
            });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Academic session not found.",
            });
        }

        // ==========================================
        // Validate class
        // ==========================================
        const classData =
            await prisma.class.findFirst({
                where: {
                    id: classId,
                    schoolId,
                    sessionId,
                },
                select: {
                    id: true,
                    className: true,
                },
            });

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: "Class not found.",
            });
        }

        // ==========================================
        // Validate section
        // ==========================================
        const section =
            await prisma.section.findFirst({
                where: {
                    id: sectionId,
                    schoolId,
                    sessionId,
                    classId,
                },
                select: {
                    id: true,
                    sectionName: true,
                },
            });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Section not found.",
            });
        }

        // ==========================================
        // Get active fee structure
        // ==========================================
        const classFeeStructure =
            await prisma.feeStructure.findFirst({
                where: {
                    schoolId,
                    sessionId,
                    classId,
                    status: true,
                },

                include: {
                    items: {
                        include: {
                            feeHead: {
                                select: {
                                    id: true,
                                    feeHeadName: true,
                                    frequency: true,
                                    isActive: true,
                                },
                            },
                        },
                    },
                },
            });

        if (!classFeeStructure) {
            return res.status(404).json({
                success: false,
                message:
                    "No active fee structure found for the selected session and class.",
            });
        }

        const activeStructureItems =
            classFeeStructure.items.filter(
                (item) =>
                    item.feeHead &&
                    item.feeHead.isActive
            );

        if (!activeStructureItems.length) {
            return res.status(400).json({
                success: false,
                message:
                    "No active fee items found in the selected fee structure.",
            });
        }

        // ==========================================
        // Get active students
        // ==========================================
        const students =
            await prisma.student.findMany({
                where: {
                    schoolId,
                    sessionId,
                    classId,
                    sectionId,
                    status: "ACTIVE",
                },

                select: {
                    id: true,
                    admissionNo: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    sessionId: true,
                    classId: true,
                    sectionId: true,
                    admissionDate: true,
                },

                orderBy: {
                    firstName: "asc",
                },
            });

        if (!students.length) {
            return res.status(404).json({
                success: false,
                message:
                    "No active students found in the selected class and section.",
            });
        }

        // ==========================================
        // Prevent exact duplicate batch
        // ==========================================
        const existingExactBatch =
            await prisma.feeInvoiceBatch.findFirst({
                where: {
                    schoolId,
                    sessionId,
                    classId,
                    sectionId,
                    invoiceName: cleanInvoiceName,
                    dateFrom: parsedDateFrom,
                    dateTo: parsedDateTo,
                },

                select: {
                    id: true,
                    invoiceName: true,
                    dateFrom: true,
                    dateTo: true,
                    dueDate: true,
                    status: true,
                    totalStudents: true,
                },
            });

        if (existingExactBatch) {
            return res.status(409).json({
                success: false,
                message:
                    "This invoice batch has already been generated.",

                data: {
                    batchId: existingExactBatch.id,
                    invoiceName:
                        existingExactBatch.invoiceName,
                    dateFrom:
                        existingExactBatch.dateFrom,
                    dateTo:
                        existingExactBatch.dateTo,
                    dueDate:
                        existingExactBatch.dueDate,
                    status:
                        existingExactBatch.status,
                },
            });
        }

        // ==========================================
        // Calculate selected months
        // ==========================================
        const selectedMonths = getInvoiceMonths(
            parsedDateFrom,
            parsedDateTo
        );

        if (!selectedMonths.length) {
            return res.status(400).json({
                success: false,
                message:
                    "Unable to calculate invoice months from the selected dates.",
            });
        }

        // ==========================================
        // Generate invoice number
        // ==========================================
        const generateInvoiceNumber = (
            studentId,
            index
        ) => {
            const timestamp = Date.now();

            const serial = String(index + 1).padStart(
                4,
                "0"
            );

            const studentCode = studentId
                .replace(/-/g, "")
                .slice(-6)
                .toUpperCase();

            return `INV-${timestamp}-${serial}-${studentCode}`;
        };

        // ==========================================
        // Transaction
        // ==========================================
        const generationResult =
            await prisma.$transaction(
                async (tx) => {
                    // Create an initially empty batch
                    const batch =
                        await tx.feeInvoiceBatch.create({
                            data: {
                                schoolId,
                                sessionId,
                                classId,
                                sectionId,

                                invoiceName:
                                    cleanInvoiceName,

                                dateFrom:
                                    parsedDateFrom,
                                dateTo: parsedDateTo,
                                dueDate: parsedDueDate,

                                totalStudents: 0,
                                totalAmount: 0,
                                paidAmount: 0,
                                pendingAmount: 0,

                                status: "PENDING",
                            },
                        });

                    const createdInvoices = [];
                    const skippedInvoices = [];

                    let skipped = 0;

                    // ==================================
                    // Generate student-wise invoices
                    // ==================================
                    for (
                        let index = 0;
                        index < students.length;
                        index++
                    ) {
                        const student = students[index];

                        // ==============================
                        // Prevent overlapping invoice
                        // ==============================
                        const existingOverlappingInvoice =
                            await tx.feeInvoice.findFirst({
                                where: {
                                    schoolId,
                                    studentId: student.id,
                                    sessionId,
                                    classId,
                                    sectionId,

                                    // Existing start date
                                    // must be <= new end date
                                    dateFrom: {
                                        lte: parsedDateTo,
                                    },

                                    // Existing end date
                                    // must be >= new start date
                                    dateTo: {
                                        gte: parsedDateFrom,
                                    },

                                    // Only cancelled invoices
                                    // allow regeneration
                                    status: {
                                        not: "CANCELLED",
                                    },
                                },

                                select: {
                                    id: true,
                                    invoiceNo: true,
                                    invoiceName: true,
                                    dateFrom: true,
                                    dateTo: true,
                                    dueDate: true,
                                    status: true,
                                    paidAmount: true,
                                    pendingAmount: true,
                                },
                            });

                        if (
                            existingOverlappingInvoice
                        ) {
                            skipped++;

                            skippedInvoices.push({
                                studentId: student.id,

                                admissionNo:
                                    student.admissionNo,

                                studentName: [
                                    student.firstName,
                                    student.middleName,
                                    student.lastName,
                                ]
                                    .filter(Boolean)
                                    .join(" "),

                                reason:
                                    "A non-cancelled invoice already exists for an overlapping date period.",

                                existingInvoice: {
                                    id:
                                        existingOverlappingInvoice.id,

                                    invoiceNo:
                                        existingOverlappingInvoice.invoiceNo,

                                    invoiceName:
                                        existingOverlappingInvoice.invoiceName,

                                    dateFrom:
                                        existingOverlappingInvoice.dateFrom,

                                    dateTo:
                                        existingOverlappingInvoice.dateTo,

                                    status:
                                        existingOverlappingInvoice.status,
                                },
                            });

                            continue;
                        }

                        // ==============================
                        // Student fee assignment
                        // ==============================
                        const assignment =
                            await tx.studentFeeAssignment.findFirst(
                                {
                                    where: {
                                        studentId:
                                            student.id,

                                        feeStructure: {
                                            schoolId,
                                            sessionId,
                                            classId,
                                            status: true,
                                        },
                                    },

                                    include: {
                                        feeStructure: {
                                            include: {
                                                items: {
                                                    include: {
                                                        feeHead:
                                                            true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                }
                            );

                        let structureItems =
                            assignment?.feeStructure
                                ?.items?.length
                                ? assignment.feeStructure
                                    .items
                                : activeStructureItems;

                        structureItems =
                            structureItems.filter(
                                (item) =>
                                    item.feeHead &&
                                    item.feeHead
                                        .isActive !==
                                    false
                            );

                        if (!structureItems.length) {
                            skipped++;

                            skippedInvoices.push({
                                studentId: student.id,
                                admissionNo:
                                    student.admissionNo,

                                studentName: [
                                    student.firstName,
                                    student.middleName,
                                    student.lastName,
                                ]
                                    .filter(Boolean)
                                    .join(" "),

                                reason:
                                    "No active fee structure items found.",
                            });

                            continue;
                        }

                        // ==============================
                        // Student-specific overrides
                        // ==============================
                        const structureItemIds =
                            structureItems.map(
                                (item) => item.id
                            );

                        const overrides =
                            await tx.studentFeeOverride.findMany(
                                {
                                    where: {
                                        studentId:
                                            student.id,

                                        feeStructureItemId:
                                        {
                                            in: structureItemIds,
                                        },
                                    },
                                }
                            );

                        const overrideMap = new Map(
                            overrides.map(
                                (override) => [
                                    override.feeStructureItemId,
                                    override,
                                ]
                            )
                        );

                        const invoiceItems = [];

                        let totalDiscount = 0;
                        let netAmount = 0;

                        // ==============================
                        // Prepare invoice items
                        // ==============================
                        for (
                            const item of structureItems
                        ) {
                            const override =
                                overrideMap.get(item.id);

                            const amount =
                                override?.amount !==
                                    null &&
                                    override?.amount !==
                                    undefined
                                    ? Number(
                                        override.amount
                                    )
                                    : Number(
                                        item.amount || 0
                                    );

                            const discount =
                                override?.discount !==
                                    null &&
                                    override?.discount !==
                                    undefined
                                    ? Number(
                                        override.discount
                                    )
                                    : 0;

                            const concession =
                                override?.concession !==
                                    null &&
                                    override?.concession !==
                                    undefined
                                    ? Number(
                                        override.concession
                                    )
                                    : Number(
                                        item.concession ||
                                        0
                                    );

                            const itemFinalAmount =
                                Math.max(
                                    amount -
                                    discount -
                                    concession,
                                    0
                                );

                            totalDiscount += discount;
                            netAmount += itemFinalAmount;

                            invoiceItems.push({
                                feeHeadId: item.feeHeadId,

                                amount,
                                concession,

                                finalAmount:
                                    itemFinalAmount,

                                selectedMonths,
                            });
                        }

                        if (!invoiceItems.length) {
                            skipped++;

                            skippedInvoices.push({
                                studentId: student.id,
                                admissionNo:
                                    student.admissionNo,

                                studentName: [
                                    student.firstName,
                                    student.middleName,
                                    student.lastName,
                                ]
                                    .filter(Boolean)
                                    .join(" "),

                                reason:
                                    "No invoice items were generated.",
                            });

                            continue;
                        }

                        const invoiceNo =
                            generateInvoiceNumber(
                                student.id,
                                index
                            );

                        // ==============================
                        // Create student invoice
                        // ==============================
                        const createdInvoice =
                            await tx.feeInvoice.create({
                                data: {
                                    schoolId,
                                    studentId: student.id,
                                    sessionId: student.sessionId,
                                    classId: student.classId,
                                    sectionId: student.sectionId,

                                    batchId: batch.id,

                                    invoiceNo,
                                    invoiceName: cleanInvoiceName,

                                    invoiceDate: new Date(),

                                    dateFrom: parsedDateFrom,
                                    dateTo: parsedDateTo,
                                    dueDate: parsedDueDate,

                                    // Net payable amount
                                    totalAmount: netAmount,

                                    discountAmount: totalDiscount,
                                    fineAmount: 0,

                                    paidAmount: 0,
                                    pendingAmount: netAmount,

                                    status: "PENDING",

                                    items: {
                                        create: invoiceItems,
                                    },
                                },

                                include: {
                                    items: true,
                                },
                            });

                        createdInvoices.push(createdInvoice);
                    }

                    const created =
                        createdInvoices.length;

                    // ==================================
                    // Remove empty batch
                    // ==================================
                    if (created === 0) {
                        await tx.feeInvoiceBatch.delete({
                            where: {
                                id: batch.id,
                            },
                        });

                        return {
                            batchId: null,
                            created: 0,
                            skipped,
                            invoices: [],
                            skippedInvoices,
                        };
                    }

                    // ==================================
                    // Batch totals
                    // ==================================
                    const batchTotalAmount =
                        createdInvoices.reduce(
                            (sum, invoice) =>
                                sum +
                                Number(invoice.totalAmount || 0),
                            0
                        );

                    await tx.feeInvoiceBatch.update({
                        where: {
                            id: batch.id,
                        },

                        data: {
                            totalStudents: created,
                            totalAmount:
                                batchTotalAmount,
                            paidAmount: 0,
                            pendingAmount:
                                batchTotalAmount,
                            status: "PENDING",
                        },
                    });

                    return {
                        batchId: batch.id,
                        created,
                        skipped,
                        skippedInvoices,

                        invoices:
                            createdInvoices.map(
                                (invoice) => ({
                                    id: invoice.id,

                                    invoiceNo:
                                        invoice.invoiceNo,

                                    studentId:
                                        invoice.studentId,

                                    totalAmount:
                                        invoice.totalAmount,

                                    pendingAmount:
                                        invoice.pendingAmount,
                                })
                            ),
                    };
                },
                {
                    timeout: 30000,
                }
            );

        // ==========================================
        // Nothing generated
        // ==========================================
        if (generationResult.created === 0) {
            return res.status(409).json({
                success: false,

                message:
                    "No invoice was generated because invoices already exist for the selected period.",

                created: 0,
                skipped: generationResult.skipped,
                totalStudents: students.length,

                conflicts:
                    generationResult.skippedInvoices,
            });
        }

        // ==========================================
        // Success response
        // ==========================================
        return res.status(201).json({
            success: true,

            message:
                generationResult.skipped > 0
                    ? "Invoices generated successfully. Some students were skipped because overlapping invoices already exist."
                    : "Fee invoices generated successfully.",

            data: {
                batchId:
                    generationResult.batchId,

                session: session.sessionName,
                class: classData.className,
                section: section.sectionName,

                invoiceName: cleanInvoiceName,

                dateFrom: parsedDateFrom,
                dateTo: parsedDateTo,
                dueDate: parsedDueDate,

                selectedMonths,

                created:
                    generationResult.created,

                skipped:
                    generationResult.skipped,

                totalStudents:
                    students.length,

                invoices:
                    generationResult.invoices,

                conflicts:
                    generationResult.skippedInvoices,
            },
        });
    } catch (error) {
        console.error(
            "Error generating fee invoices:",
            error
        );

        // ==========================================
        // Unique constraint error
        // ==========================================
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message:
                    "Duplicate invoice or invoice batch already exists.",
                fields: error.meta?.target,
            });
        }

        // ==========================================
        // Foreign-key error
        // ==========================================
        if (error.code === "P2003") {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid Session, Class, Section, Student or Fee Head reference.",
            });
        }

        // ==========================================
        // Transaction timeout/conflict
        // ==========================================
        if (error.code === "P2028") {
            return res.status(408).json({
                success: false,
                message:
                    "Invoice generation transaction timed out. Please try again.",
            });
        }

        return res.status(500).json({
            success: false,

            message:
                error.message ||
                "Unable to generate fee invoices.",

            stack:
                process.env.NODE_ENV ===
                    "development"
                    ? error.stack
                    : undefined,
        });
    }
};


exports.index = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sessionId,
            classId,
            sectionId,
            invoiceName,
            dateFrom,
            dateTo,
            dueDate,
            status,
            search,
        } = req.query;

        const schoolId = req.user.schoolId;

        // ==========================================
        // Pagination
        // ==========================================
        const currentPage = Math.max(
            Number.parseInt(page, 10) || 1,
            1
        );

        const perPage = Math.min(
            Math.max(Number.parseInt(limit, 10) || 10, 1),
            100
        );

        const skip = (currentPage - 1) * perPage;

        // ==========================================
        // Base filters
        // ==========================================
        const where = {
            schoolId,
            AND: [],
        };

        if (sessionId) {
            where.sessionId = sessionId;
        }

        if (classId) {
            where.classId = classId;
        }

        if (sectionId) {
            where.sectionId = sectionId;
        }

        if (status) {
            const allowedStatuses = [
                "PENDING",
                "PARTIALLY_PAID",
                "PAID",
                "CANCELLED",
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid invoice status. Allowed statuses: ${allowedStatuses.join(
                        ", "
                    )}`,
                });
            }

            where.status = status;
        }

        // ==========================================
        // Invoice name filter
        // ==========================================
        if (invoiceName?.trim()) {
            where.invoiceName = {
                contains: invoiceName.trim(),
                mode: "insensitive",
            };
        }

        // ==========================================
        // Invoice period filters
        // ==========================================
        if (dateFrom) {
            const parsedDateFrom = new Date(dateFrom);

            if (Number.isNaN(parsedDateFrom.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Date From.",
                });
            }

            parsedDateFrom.setHours(0, 0, 0, 0);

            where.AND.push({
                dateFrom: {
                    gte: parsedDateFrom,
                },
            });
        }

        if (dateTo) {
            const parsedDateTo = new Date(dateTo);

            if (Number.isNaN(parsedDateTo.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Date To.",
                });
            }

            parsedDateTo.setHours(23, 59, 59, 999);

            where.AND.push({
                dateTo: {
                    lte: parsedDateTo,
                },
            });
        }

        // ==========================================
        // Due-date filter
        // ==========================================
        if (dueDate) {
            const dueDateStart = new Date(dueDate);

            if (Number.isNaN(dueDateStart.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Due Date.",
                });
            }

            dueDateStart.setHours(0, 0, 0, 0);

            const dueDateEnd = new Date(dueDate);
            dueDateEnd.setHours(23, 59, 59, 999);

            where.AND.push({
                dueDate: {
                    gte: dueDateStart,
                    lte: dueDateEnd,
                },
            });
        }

        // ==========================================
        // Search filter
        // ==========================================
        // ==========================================
        // Search filter
        // ==========================================
        if (search?.trim()) {
            const searchValue = search.trim();
            const parsedRollNo = Number(searchValue);

            const searchConditions = [
                {
                    invoiceNo: {
                        contains: searchValue,
                        mode: "insensitive",
                    },
                },
                {
                    invoiceName: {
                        contains: searchValue,
                        mode: "insensitive",
                    },
                },
                {
                    student: {
                        is: {
                            firstName: {
                                contains: searchValue,
                                mode: "insensitive",
                            },
                        },
                    },
                },
                {
                    student: {
                        is: {
                            lastName: {
                                contains: searchValue,
                                mode: "insensitive",
                            },
                        },
                    },
                },
                {
                    student: {
                        is: {
                            admissionNo: {
                                contains: searchValue,
                                mode: "insensitive",
                            },
                        },
                    },
                },
            ];

            // Roll number केवल तभी search करें जब input valid integer हो
            if (
                searchValue !== "" &&
                Number.isInteger(parsedRollNo)
            ) {
                searchConditions.push({
                    student: {
                        is: {
                            rollNo: {
                                equals: parsedRollNo,
                            },
                        },
                    },
                });
            }

            where.AND.push({
                OR: searchConditions,
            });
        }

        // Empty AND remove kar dein
        if (where.AND.length === 0) {
            delete where.AND;
        }

        // ==========================================
        // Count and invoice list
        // ==========================================
        const totalRecords = await prisma.feeInvoice.count({
            where,
        });

        const invoices = await prisma.feeInvoice.findMany({
            where,

            include: {
                student: {
                    select: {
                        id: true,
                        admissionNo: true,
                        rollNo: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        classId: true,
                        sectionId: true,
                    },
                },

                class: {
                    select: {
                        id: true,
                        className: true,
                        sortName: true,
                    },
                },

                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },

                session: {
                    select: {
                        id: true,
                        sessionName: true,
                    },
                },

                items: {
                    include: {
                        feeHead: {
                            select: {
                                id: true,
                                feeHeadName: true,
                                frequency: true,
                                description: true,
                                taxable: true,
                                isActive: true,
                            },
                        },
                    },

                    orderBy: {
                        createdAt: "asc",
                    },
                },

                payments: {
                    where: {
                        status: "SUCCESS",
                    },

                    select: {
                        id: true,
                        amount: true,
                        paymentMode: true,
                        status: true,
                        transactionId: true,
                        paymentDate: true,
                        remarks: true,
                    },

                    orderBy: {
                        paymentDate: "desc",
                    },
                },
            },

            orderBy: {
                createdAt: "desc",
            },

            skip,
            take: perPage,
        });

        // ==========================================
        // Current-page summary
        // ==========================================
        const summary = invoices.reduce(
            (result, invoice) => {
                result.totalAmount += Number(
                    invoice.totalAmount || 0
                );

                result.totalPaid += Number(
                    invoice.paidAmount || 0
                );

                result.totalPending += Number(
                    invoice.pendingAmount || 0
                );

                result.totalDiscount += Number(
                    invoice.discountAmount || 0
                );

                result.totalFine += Number(
                    invoice.fineAmount || 0
                );

                return result;
            },
            {
                totalAmount: 0,
                totalPaid: 0,
                totalPending: 0,
                totalDiscount: 0,
                totalFine: 0,
            }
        );

        const totalPages = Math.ceil(
            totalRecords / perPage
        );

        return res.status(200).json({
            success: true,
            message: "Fee invoices fetched successfully.",

            total: totalRecords,

            // Ye current page ke invoice records ka summary hai
            summary,

            pagination: {
                currentPage,
                totalPages,
                totalRecords,
                perPage,

                prevPage:
                    currentPage > 1
                        ? currentPage - 1
                        : null,

                nextPage:
                    currentPage < totalPages
                        ? currentPage + 1
                        : null,
            },

            data: invoices,
        });
    } catch (error) {
        console.error(
            "Error in invoice index:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to fetch fee invoices.",
            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined,
        });
    }
};


exports.show = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.schoolId;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invoice ID is required.",
            });
        }

        const invoice = await prisma.feeInvoice.findFirst({
            where: {
                id,
                schoolId,
            },

            include: {
                student: {
                    select: {
                        id: true,
                        admissionNo: true,
                        rollNo: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                    },
                },

                class: {
                    select: {
                        id: true,
                        className: true,
                        sortName: true,
                    },
                },

                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },

                session: {
                    select: {
                        id: true,
                        sessionName: true,
                    },
                },

                batch: {
                    select: {
                        id: true,
                        invoiceName: true,
                        dateFrom: true,
                        dateTo: true,
                        dueDate: true,
                        totalStudents: true,
                        totalAmount: true,
                        paidAmount: true,
                        pendingAmount: true,
                        // status: true,
                    },
                },

                items: {
                    include: {
                        feeHead: {
                            select: {
                                id: true,
                                feeHeadName: true,
                                frequency: true,
                                description: true,
                                taxable: true,
                                isActive: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                },

                payments: {
                    where: {
                        status: "SUCCESS",
                    },
                    select: {
                        id: true,
                        amount: true,
                        paymentMode: true,
                        status: true,
                        transactionId: true,
                        paymentDate: true,
                        remarks: true,
                    },
                    orderBy: {
                        paymentDate: "desc",
                    },
                },

                receipts: true,
            },
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        // ==========================================
        // Format invoice items
        // ==========================================
        const formattedItems = invoice.items.map(
            (item) => {
                const amount = Number(item.amount || 0);

                // Student special discount is stored
                // inside concession
                const concession = Number(
                    item.concession || 0
                );

                const payableAmount =
                    item.finalAmount !== null &&
                        item.finalAmount !== undefined
                        ? Number(item.finalAmount)
                        : Math.max(
                            amount - concession,
                            0
                        );

                return {
                    ...item,

                    amount,

                    // Original database field
                    concession,

                    // Frontend-friendly aliases
                    discount: concession,
                    specialDiscount: concession,

                    finalAmount: payableAmount,
                    payableAmount,
                };
            }
        );

        // ==========================================
        // Calculate invoice totals
        // ==========================================
        const grossAmount = formattedItems.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        const concessionAmount =
            formattedItems.reduce(
                (sum, item) =>
                    sum + item.concession,
                0
            );

        const finalAmount = formattedItems.reduce(
            (sum, item) =>
                sum + item.finalAmount,
            0
        );

        const paidAmount = invoice.payments.reduce(
            (sum, payment) =>
                sum + Number(payment.amount || 0),
            0
        );

        const invoiceDiscountAmount = Number(
            invoice.discountAmount || 0
        );

        const fineAmount = Number(
            invoice.fineAmount || 0
        );

        const pendingAmount = Math.max(
            finalAmount + fineAmount - paidAmount,
            0
        );

        let calculatedStatus = "PENDING";

        if (pendingAmount <= 0) {
            calculatedStatus = "PAID";
        } else if (paidAmount > 0) {
            calculatedStatus = "PARTIALLY_PAID";
        }

        return res.status(200).json({
            success: true,
            message: "Invoice fetched successfully.",

            data: {
                ...invoice,

                // Original items overwrite karke
                // formatted items return karenge
                items: formattedItems,

                summary: {
                    grossAmount,

                    // ₹1300
                    totalAmount: grossAmount,

                    // Invoice-level discount
                    discountAmount:
                        invoiceDiscountAmount,

                    // Tinku special discount ₹200
                    concessionAmount,

                    specialDiscountAmount:
                        concessionAmount,

                    fineAmount,

                    // ₹1100
                    finalAmount,

                    paidAmount,

                    // ₹1100
                    pendingAmount,

                    status: calculatedStatus,
                },
            },
        });
    } catch (error) {
        console.error(
            "Error fetching invoice:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to fetch invoice.",
            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined,
        });
    }
};


exports.update = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            invoiceId,
            sessionId,
            classId,
            sectionId,
            invoiceName,
            dateFrom,
            dateTo,
            dueDate,
            items
        } = req.body;


        const schoolId = req.user.schoolId;



        // Validation

        if (!invoiceId || invoiceId !== id) {
            return res.status(400).json({
                success: false,
                message: "Invoice ID mismatch."
            });
        }


        if (!sessionId || !classId || !sectionId) {
            return res.status(400).json({
                success: false,
                message: "Session, class and section required."
            });
        }


        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invoice items required."
            });
        }




        // Get invoice

        const invoice = await prisma.feeInvoice.findFirst({

            where: {
                id,
                schoolId
            },

            include: {
                payments: {
                    where: {
                        status: "SUCCESS"
                    }
                }
            }

        });



        if (!invoice) {

            return res.status(404).json({
                success: false,
                message: "Invoice not found."
            });

        }



        // Payment check

        const alreadyPaid =
            invoice.payments.reduce(
                (sum, p) => sum + Number(p.amount),
                0
            );



        if (alreadyPaid > 0) {

            return res.status(400).json({
                success: false,
                message: "Paid invoice cannot be updated."
            });

        }





        // Validate fee heads


        const feeHeadIds =
            items.map(i => i.feeHeadId);



        const feeHeads =
            await prisma.feeHead.findMany({

                where: {
                    id: {
                        in: feeHeadIds
                    },
                    schoolId
                }

            });



        if (feeHeads.length !== feeHeadIds.length) {

            return res.status(400).json({
                success: false,
                message: "Invalid fee head."
            });

        }





        // Calculate items


        let totalAmount = 0;

        let totalConcession = 0;



        const invoiceItems =
            items.map(item => {


                const amount =
                    Number(item.amount || 0);



                const concession =
                    Number(item.concession || 0);



                const finalAmount =
                    amount - concession;



                totalAmount += amount;

                totalConcession += concession;



                return {

                    invoiceId: id,

                    feeHeadId: item.feeHeadId,

                    amount,

                    concession,

                    finalAmount,

                    selectedMonths:
                        item.selectedMonths || []

                };


            });





        const pendingAmount =
            totalAmount - totalConcession;



        let updatedInvoice;




        await prisma.$transaction(async (tx) => {



            // Delete old items

            await tx.feeInvoiceItem.deleteMany({

                where: {
                    invoiceId: id
                }

            });




            // Create new items

            await tx.feeInvoiceItem.createMany({

                data: invoiceItems

            });





            // Update Invoice


            updatedInvoice =
                await tx.feeInvoice.update({

                    where: {
                        id
                    },


                    data: {


                        sessionId,

                        classId,

                        sectionId,


                        invoiceName,


                        dateFrom:
                            dateFrom
                                ? new Date(dateFrom)
                                : invoice.dateFrom,


                        dateTo:
                            dateTo
                                ? new Date(dateTo)
                                : invoice.dateTo,


                        dueDate:
                            dueDate
                                ? new Date(dueDate)
                                : invoice.dueDate,



                        totalAmount,


                        discountAmount: 0,


                        paidAmount: 0,


                        pendingAmount,



                        status:
                            pendingAmount === 0
                                ? "PAID"
                                : "PENDING"



                    },


                    include: {

                        items: {
                            include: {
                                feeHead: true
                            }
                        },

                        student: true,

                        class: true,

                        section: true,

                        session: true

                    }


                });







            // Update Batch


            if (invoice.batchId) {


                const batchInvoices =
                    await tx.feeInvoice.findMany({

                        where: {
                            batchId: invoice.batchId
                        },

                        select: {

                            totalAmount: true,

                            paidAmount: true,

                            pendingAmount: true

                        }

                    });





                const batchTotal =
                    batchInvoices.reduce(
                        (sum, i) =>
                            sum + Number(i.totalAmount),
                        0
                    );



                const batchPaid =
                    batchInvoices.reduce(
                        (sum, i) =>
                            sum + Number(i.paidAmount),
                        0
                    );



                const batchPending =
                    batchInvoices.reduce(
                        (sum, i) =>
                            sum + Number(i.pendingAmount),
                        0
                    );






                await tx.feeInvoiceBatch.update({
                    where: {
                        id: invoice.batchId,
                    },
                    data: {
                        totalAmount: batchTotal,
                        paidAmount: batchPaid,
                        pendingAmount: batchPending,

                        status:
                            Number(batchPending) <= 0
                                ? "PAID"
                                : Number(batchPaid) > 0
                                    ? "PARTIAL"
                                    : "PENDING",
                    },
                });



            }
        });

        return res.status(200).json({

            success: true,

            message: "Invoice updated successfully.",

            data: updatedInvoice

        });



    }
    catch (error) {

        console.log(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }
};


exports.downloadInvoices = async (req, res) => {
    try {
        const {
            format = "excel",
            sessionId,
            classId,
            sectionId,
            invoiceName,
            dateFrom,
            dateTo,
            dueDate,
            status,
            search,
        } = req.query;

        const schoolId = req.user.schoolId;
        const downloadFormat = format.toLowerCase();

        if (!["excel", "xlsx", "pdf"].includes(downloadFormat)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid format. Allowed formats are excel, xlsx and pdf.",
            });
        }

        // ==========================================
        // Build invoice filters
        // ==========================================
        const where = {
            schoolId,
            AND: [],
        };

        if (sessionId) {
            where.sessionId = sessionId;
        }

        if (classId) {
            where.classId = classId;
        }

        if (sectionId) {
            where.sectionId = sectionId;
        }

        if (status) {
            where.status = status;
        }

        if (invoiceName?.trim()) {
            where.invoiceName = {
                contains: invoiceName.trim(),
                mode: "insensitive",
            };
        }

        // Date From
        if (dateFrom) {
            const startDate = new Date(dateFrom);

            if (Number.isNaN(startDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Date From.",
                });
            }

            startDate.setHours(0, 0, 0, 0);

            where.AND.push({
                dateFrom: {
                    gte: startDate,
                },
            });
        }

        // Date To
        if (dateTo) {
            const endDate = new Date(dateTo);

            if (Number.isNaN(endDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Date To.",
                });
            }

            endDate.setHours(23, 59, 59, 999);

            where.AND.push({
                dateTo: {
                    lte: endDate,
                },
            });
        }

        // Due Date
        if (dueDate) {
            const dueDateStart = new Date(dueDate);

            if (Number.isNaN(dueDateStart.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Due Date.",
                });
            }

            dueDateStart.setHours(0, 0, 0, 0);

            const dueDateEnd = new Date(dueDate);
            dueDateEnd.setHours(23, 59, 59, 999);

            where.AND.push({
                dueDate: {
                    gte: dueDateStart,
                    lte: dueDateEnd,
                },
            });
        }

        // Search
        if (search?.trim()) {
            const searchValue = search.trim();

            where.AND.push({
                OR: [
                    {
                        invoiceNo: {
                            contains: searchValue,
                            mode: "insensitive",
                        },
                    },
                    {
                        invoiceName: {
                            contains: searchValue,
                            mode: "insensitive",
                        },
                    },
                    {
                        student: {
                            is: {
                                firstName: {
                                    contains: searchValue,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        student: {
                            is: {
                                lastName: {
                                    contains: searchValue,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        student: {
                            is: {
                                admissionNo: {
                                    contains: searchValue,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                ],
            });
        }

        if (where.AND.length === 0) {
            delete where.AND;
        }

        // ==========================================
        // Get school and ALL matching invoices
        // No pagination
        // ==========================================
        const [school, invoices] = await Promise.all([
            prisma.school.findUnique({
                where: {
                    id: schoolId,
                },
                select: {
                    id: true,
                    name: true,
                    board: true,
                    affiliationNo: true,
                    addressLine: true,
                    city: true,
                    district: true,
                    state: true,
                    country: true,
                    pincode: true,
                    phone: true,
                    email: true,
                    website: true,
                    logo: true,
                },
            }),

            prisma.feeInvoice.findMany({
                where,

                include: {
                    student: {
                        select: {
                            id: true,
                            admissionNo: true,
                            rollNo: true,
                            firstName: true,
                            middleName: true,
                            lastName: true,
                        },
                    },

                    class: {
                        select: {
                            id: true,
                            className: true,
                            sortName: true,
                        },
                    },

                    section: {
                        select: {
                            id: true,
                            sectionName: true,
                        },
                    },

                    session: {
                        select: {
                            id: true,
                            sessionName: true,
                        },
                    },

                    items: {
                        include: {
                            feeHead: {
                                select: {
                                    id: true,
                                    feeHeadName: true,
                                },
                            },
                        },
                        orderBy: {
                            createdAt: "asc",
                        },
                    },

                    payments: {
                        where: {
                            status: "SUCCESS",
                        },
                        select: {
                            id: true,
                            amount: true,
                            paymentMode: true,
                            transactionId: true,
                            paymentDate: true,
                        },
                    },
                },

                orderBy: {
                    createdAt: "desc",
                },
            }),
        ]);

        if (!invoices.length) {
            return res.status(404).json({
                success: false,
                message:
                    "No fee invoice records found for download.",
            });
        }

        // ==========================================
        // Date formatter
        // ==========================================
        const formatDate = (date) => {
            if (!date) return "";

            return new Intl.DateTimeFormat("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }).format(new Date(date));
        };

        // ==========================================
        // Format invoice records
        // ==========================================
        const formattedInvoices = invoices.map(
            (invoice, index) => {
                const studentName = [
                    invoice.student?.firstName,
                    invoice.student?.middleName,
                    invoice.student?.lastName,
                ]
                    .filter(Boolean)
                    .join(" ");

                const grossAmount =
                    invoice.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(item.amount || 0),
                        0
                    );

                const concessionAmount =
                    invoice.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.concession || 0
                            ),
                        0
                    );

                const netAmount =
                    invoice.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.finalAmount || 0
                            ),
                        0
                    );

                const paidAmount =
                    invoice.payments.reduce(
                        (sum, payment) =>
                            sum +
                            Number(
                                payment.amount || 0
                            ),
                        0
                    );

                const fineAmount = Number(
                    invoice.fineAmount || 0
                );

                const pendingAmount = Math.max(
                    netAmount +
                    fineAmount -
                    paidAmount,
                    0
                );

                const feeDetails = invoice.items
                    .map((item) => {
                        const feeName =
                            item.feeHead
                                ?.feeHeadName ||
                            "Fee";

                        const amount = Number(
                            item.amount || 0
                        );

                        const concession = Number(
                            item.concession || 0
                        );

                        const payable = Number(
                            item.finalAmount || 0
                        );

                        return `${feeName}: ₹${amount.toFixed(
                            2
                        )} - ₹${concession.toFixed(
                            2
                        )} = ₹${payable.toFixed(
                            2
                        )}`;
                    })
                    .join(", ");

                return {
                    serialNo: index + 1,
                    studentName,
                    admissionNo:
                        invoice.student
                            ?.admissionNo || "",
                    rollNo:
                        invoice.student?.rollNo ||
                        "",
                    invoiceNo:
                        invoice.invoiceNo || "",
                    invoiceName:
                        invoice.invoiceName || "",
                    session:
                        invoice.session
                            ?.sessionName || "",
                    className:
                        invoice.class
                            ?.className ||
                        invoice.class?.sortName ||
                        "",
                    sectionName:
                        invoice.section
                            ?.sectionName || "",
                    dateFrom: formatDate(
                        invoice.dateFrom
                    ),
                    dateTo: formatDate(
                        invoice.dateTo
                    ),
                    dueDate: formatDate(
                        invoice.dueDate
                    ),
                    feeDetails,
                    grossAmount,
                    concessionAmount,
                    netAmount,
                    fineAmount,
                    paidAmount,
                    pendingAmount,
                    status:
                        pendingAmount <= 0
                            ? "PAID"
                            : paidAmount > 0
                                ? "PARTIAL"
                                : "PENDING",
                };
            }
        );

        const totals = formattedInvoices.reduce(
            (result, invoice) => {
                result.grossAmount +=
                    invoice.grossAmount;

                result.concessionAmount +=
                    invoice.concessionAmount;

                result.netAmount +=
                    invoice.netAmount;

                result.fineAmount +=
                    invoice.fineAmount;

                result.paidAmount +=
                    invoice.paidAmount;

                result.pendingAmount +=
                    invoice.pendingAmount;

                return result;
            },
            {
                grossAmount: 0,
                concessionAmount: 0,
                netAmount: 0,
                fineAmount: 0,
                paidAmount: 0,
                pendingAmount: 0,
            }
        );

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        // ==========================================
        // Excel download
        // ==========================================
        if (
            downloadFormat === "excel" ||
            downloadFormat === "xlsx"
        ) {
            const workbook = new ExcelJS.Workbook();

            workbook.creator =
                school?.schoolName ||
                "GlobalEdu CRM";

            workbook.created = new Date();

            const worksheet =
                workbook.addWorksheet(
                    "Fee Invoices",
                    {
                        views: [
                            {
                                state: "frozen",
                                ySplit: 5,
                            },
                        ],
                    }
                );

            // School heading
            worksheet.mergeCells("A1:U1");

            const schoolNameCell =
                worksheet.getCell("A1");

            schoolNameCell.value =
                school?.schoolName ||
                "School Fee Invoice Report";

            schoolNameCell.font = {
                bold: true,
                size: 18,
                color: {
                    argb: "FFFFFFFF",
                },
            };

            schoolNameCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "FF7E22CE",
                },
            };

            schoolNameCell.alignment = {
                horizontal: "center",
                vertical: "middle",
            };

            worksheet.getRow(1).height = 32;

            // Address
            worksheet.mergeCells("A2:U2");

            worksheet.getCell("A2").value = [
                school?.addressLine,
                school?.city,
                school?.state,
                school?.pincode,
            ]
                .filter(Boolean)
                .join(", ");

            worksheet.getCell("A2").alignment = {
                horizontal: "center",
            };

            // Report title
            worksheet.mergeCells("A3:U3");

            worksheet.getCell("A3").value =
                "Fee Invoice Report";

            worksheet.getCell("A3").font = {
                bold: true,
                size: 14,
            };

            worksheet.getCell("A3").alignment = {
                horizontal: "center",
            };

            worksheet.mergeCells("A4:U4");

            worksheet.getCell("A4").value =
                `Generated: ${formatDate(
                    new Date()
                )} | Total invoices: ${formattedInvoices.length
                }`;

            worksheet.getCell("A4").alignment = {
                horizontal: "center",
            };

            // Columns
            worksheet.columns = [
                {
                    header: "#",
                    key: "serialNo",
                    width: 6,
                },
                {
                    header: "Student",
                    key: "studentName",
                    width: 24,
                },
                {
                    header: "Admission No",
                    key: "admissionNo",
                    width: 18,
                },
                {
                    header: "Roll No",
                    key: "rollNo",
                    width: 12,
                },
                {
                    header: "Invoice No",
                    key: "invoiceNo",
                    width: 28,
                },
                {
                    header: "Invoice Name",
                    key: "invoiceName",
                    width: 18,
                },
                {
                    header: "Session",
                    key: "session",
                    width: 16,
                },
                {
                    header: "Class",
                    key: "className",
                    width: 12,
                },
                {
                    header: "Section",
                    key: "sectionName",
                    width: 10,
                },
                {
                    header: "Date From",
                    key: "dateFrom",
                    width: 14,
                },
                {
                    header: "Date To",
                    key: "dateTo",
                    width: 14,
                },
                {
                    header: "Due Date",
                    key: "dueDate",
                    width: 14,
                },
                {
                    header: "Fee Details",
                    key: "feeDetails",
                    width: 55,
                },
                {
                    header: "Gross Amount",
                    key: "grossAmount",
                    width: 16,
                },
                {
                    header: "Discount",
                    key: "concessionAmount",
                    width: 15,
                },
                {
                    header: "Net Amount",
                    key: "netAmount",
                    width: 15,
                },
                {
                    header: "Fine",
                    key: "fineAmount",
                    width: 12,
                },
                {
                    header: "Paid",
                    key: "paidAmount",
                    width: 15,
                },
                {
                    header: "Pending",
                    key: "pendingAmount",
                    width: 15,
                },
                {
                    header: "Status",
                    key: "status",
                    width: 14,
                },
            ];

            // ExcelJS header row is row 1 by default,
            // therefore manually create report table at row 5
            const headerRow = worksheet.getRow(5);

            const headers = [
                "#",
                "Student",
                "Admission No",
                "Roll No",
                "Invoice No",
                "Invoice Name",
                "Session",
                "Class",
                "Section",
                "Date From",
                "Date To",
                "Due Date",
                "Fee Details",
                "Gross Amount",
                "Discount",
                "Net Amount",
                "Fine",
                "Paid",
                "Pending",
                "Status",
            ];

            headerRow.values = headers;

            headerRow.eachCell((cell) => {
                cell.font = {
                    bold: true,
                    color: {
                        argb: "FFFFFFFF",
                    },
                };

                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: {
                        argb: "FF6B21A8",
                    },
                };

                cell.alignment = {
                    horizontal: "center",
                    vertical: "middle",
                    wrapText: true,
                };

                cell.border = {
                    top: {
                        style: "thin",
                    },
                    left: {
                        style: "thin",
                    },
                    bottom: {
                        style: "thin",
                    },
                    right: {
                        style: "thin",
                    },
                };
            });

            formattedInvoices.forEach((invoice) => {
                const row = worksheet.addRow([
                    invoice.serialNo,
                    invoice.studentName,
                    invoice.admissionNo,
                    invoice.rollNo,
                    invoice.invoiceNo,
                    invoice.invoiceName,
                    invoice.session,
                    invoice.className,
                    invoice.sectionName,
                    invoice.dateFrom,
                    invoice.dateTo,
                    invoice.dueDate,
                    invoice.feeDetails,
                    invoice.grossAmount,
                    invoice.concessionAmount,
                    invoice.netAmount,
                    invoice.fineAmount,
                    invoice.paidAmount,
                    invoice.pendingAmount,
                    invoice.status,
                ]);

                row.eachCell((cell) => {
                    cell.alignment = {
                        vertical: "top",
                        wrapText: true,
                    };

                    cell.border = {
                        top: {
                            style: "thin",
                            color: {
                                argb: "FFD1D5DB",
                            },
                        },
                        left: {
                            style: "thin",
                            color: {
                                argb: "FFD1D5DB",
                            },
                        },
                        bottom: {
                            style: "thin",
                            color: {
                                argb: "FFD1D5DB",
                            },
                        },
                        right: {
                            style: "thin",
                            color: {
                                argb: "FFD1D5DB",
                            },
                        },
                    };
                });

                // Currency columns
                for (
                    let column = 14;
                    column <= 19;
                    column++
                ) {
                    row.getCell(column).numFmt =
                        '₹#,##0.00';
                }
            });

            // Total row
            const totalRow = worksheet.addRow([
                "",
                "TOTAL",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                totals.grossAmount,
                totals.concessionAmount,
                totals.netAmount,
                totals.fineAmount,
                totals.paidAmount,
                totals.pendingAmount,
                "",
            ]);

            totalRow.font = {
                bold: true,
            };

            totalRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "FFF3E8FF",
                },
            };

            for (
                let column = 14;
                column <= 19;
                column++
            ) {
                totalRow.getCell(column).numFmt =
                    '₹#,##0.00';
            }

            worksheet.autoFilter = {
                from: "A5",
                to: "T5",
            };

            const buffer =
                await workbook.xlsx.writeBuffer();

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="fee-invoices-${timestamp}.xlsx"`
            );

            res.setHeader(
                "Content-Length",
                buffer.length
            );

            return res.end(buffer);
        }

        // ==========================================
        // PDF download
        // ==========================================
        const document = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margin: 25,
            bufferPages: true,
        });

        const chunks = [];

        document.on("data", (chunk) => {
            chunks.push(chunk);
        });

        document.on("end", () => {
            const pdfBuffer = Buffer.concat(chunks);

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="fee-invoices-${timestamp}.pdf"`
            );

            res.setHeader(
                "Content-Length",
                pdfBuffer.length
            );

            return res.end(pdfBuffer);
        });

        // PDF heading
        document
            .font("Helvetica-Bold")
            .fontSize(16)
            .fillColor("#6b21a8")
            .text(
                school?.schoolName ||
                "School Fee Invoice Report",
                {
                    align: "center",
                }
            );

        document
            .font("Helvetica")
            .fontSize(8)
            .fillColor("#374151")
            .text(
                [
                    school?.addressLine,
                    school?.city,
                    school?.state,
                    school?.pincode,
                ]
                    .filter(Boolean)
                    .join(", "),
                {
                    align: "center",
                }
            );

        document.moveDown(0.4);

        document
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor("#111827")
            .text("Fee Invoice Report", {
                align: "center",
            });

        document
            .font("Helvetica")
            .fontSize(8)
            .text(
                `Generated: ${formatDate(
                    new Date()
                )} | Total invoices: ${formattedInvoices.length
                }`,
                {
                    align: "center",
                }
            );

        document.moveDown(1);

        // PDF table configuration
        const columns = [
            {
                title: "#",
                key: "serialNo",
                width: 22,
            },
            {
                title: "Student",
                key: "student",
                width: 85,
            },
            {
                title: "Invoice",
                key: "invoice",
                width: 95,
            },
            {
                title: "Period",
                key: "period",
                width: 70,
            },
            {
                title: "Gross",
                key: "gross",
                width: 55,
            },
            {
                title: "Discount",
                key: "discount",
                width: 55,
            },
            {
                title: "Net",
                key: "net",
                width: 55,
            },
            {
                title: "Paid",
                key: "paid",
                width: 55,
            },
            {
                title: "Pending",
                key: "pending",
                width: 55,
            },
            {
                title: "Status",
                key: "status",
                width: 50,
            },
        ];

        const startX = 25;
        const rowHeight = 28;

        const drawTableHeader = () => {
            const y = document.y;

            document
                .rect(
                    startX,
                    y,
                    697,
                    rowHeight
                )
                .fill("#6b21a8");

            let x = startX;

            columns.forEach((column) => {
                document
                    .font("Helvetica-Bold")
                    .fontSize(7)
                    .fillColor("#ffffff")
                    .text(
                        column.title,
                        x + 3,
                        y + 9,
                        {
                            width:
                                column.width - 6,
                            align: "center",
                        }
                    );

                x += column.width;
            });

            document.y = y + rowHeight;
        };

        drawTableHeader();

        formattedInvoices.forEach((invoice) => {
            if (
                document.y + rowHeight >
                document.page.height - 40
            ) {
                document.addPage();
                drawTableHeader();
            }

            const y = document.y;

            document
                .rect(
                    startX,
                    y,
                    697,
                    rowHeight
                )
                .fill(
                    invoice.serialNo % 2 === 0
                        ? "#f9fafb"
                        : "#ffffff"
                );

            const rowData = [
                String(invoice.serialNo),
                `${invoice.studentName}\n${invoice.admissionNo}`,
                `${invoice.invoiceName}\n${invoice.invoiceNo}`,
                `${invoice.dateFrom}\n${invoice.dateTo}`,
                `₹${invoice.grossAmount.toFixed(2)}`,
                `₹${invoice.concessionAmount.toFixed(2)}`,
                `₹${invoice.netAmount.toFixed(2)}`,
                `₹${invoice.paidAmount.toFixed(2)}`,
                `₹${invoice.pendingAmount.toFixed(2)}`,
                invoice.status,
            ];

            let x = startX;

            columns.forEach((column, index) => {
                document
                    .font("Helvetica")
                    .fontSize(6.5)
                    .fillColor("#111827")
                    .text(
                        rowData[index],
                        x + 3,
                        y + 5,
                        {
                            width:
                                column.width - 6,
                            height:
                                rowHeight - 8,
                            align:
                                index >= 4 &&
                                    index <= 8
                                    ? "right"
                                    : "left",
                            ellipsis: true,
                        }
                    );

                document
                    .rect(
                        x,
                        y,
                        column.width,
                        rowHeight
                    )
                    .stroke("#d1d5db");

                x += column.width;
            });

            document.y = y + rowHeight;
        });

        // PDF total row
        if (
            document.y + rowHeight >
            document.page.height - 40
        ) {
            document.addPage();
            drawTableHeader();
        }

        const totalY = document.y;

        document
            .rect(
                startX,
                totalY,
                697,
                rowHeight
            )
            .fill("#f3e8ff");

        const totalRowData = [
            "",
            "TOTAL",
            "",
            "",
            `₹${totals.grossAmount.toFixed(2)}`,
            `₹${totals.concessionAmount.toFixed(2)}`,
            `₹${totals.netAmount.toFixed(2)}`,
            `₹${totals.paidAmount.toFixed(2)}`,
            `₹${totals.pendingAmount.toFixed(2)}`,
            "",
        ];

        let totalX = startX;

        columns.forEach((column, index) => {
            document
                .font("Helvetica-Bold")
                .fontSize(6.5)
                .fillColor("#111827")
                .text(
                    totalRowData[index],
                    totalX + 3,
                    totalY + 9,
                    {
                        width:
                            column.width - 6,
                        align:
                            index >= 4 &&
                                index <= 8
                                ? "right"
                                : "left",
                    }
                );

            document
                .rect(
                    totalX,
                    totalY,
                    column.width,
                    rowHeight
                )
                .stroke("#a855f7");

            totalX += column.width;
        });

        // Page numbers
        const pageRange =
            document.bufferedPageRange();

        for (
            let pageIndex = 0;
            pageIndex < pageRange.count;
            pageIndex++
        ) {
            document.switchToPage(pageIndex);

            document
                .font("Helvetica")
                .fontSize(7)
                .fillColor("#6b7280")
                .text(
                    `Page ${pageIndex + 1} of ${pageRange.count
                    }`,
                    25,
                    document.page.height - 20,
                    {
                        width:
                            document.page.width -
                            50,
                        align: "center",
                    }
                );
        }

        document.end();
    } catch (error) {
        console.error(
            "Invoice download error:",
            error
        );

        if (res.headersSent) {
            return res.end();
        }

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to download invoices.",
            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined,
        });
    }
};


exports.getStudentFeeInvoices = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    const { studentId } = req.params;

    const {
      sessionId,
      status,
      search,
      page = "1",
      limit = "10",
    } = req.query;

    // -----------------------------------------
    // Validation
    // -----------------------------------------
    if (!schoolId) {
      return res.status(403).json({
        success: false,
        message: "School access is required.",
      });
    }

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    const currentPage = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (currentPage - 1) * perPage;

    // -----------------------------------------
    // Verify student belongs to school
    // -----------------------------------------
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
      },

      select: {
        id: true,
        admissionNo: true,
        rollNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        image: true,

        class: {
          select: {
            id: true,
            className: true,
          },
        },

        section: {
          select: {
            id: true,
            sectionName: true,
          },
        },

        session: {
          select: {
            id: true,
            sessionName: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // -----------------------------------------
    // Invoice filters
    // -----------------------------------------
    const invoiceWhere = {
      schoolId,
      studentId,
    };

    if (sessionId) {
      invoiceWhere.sessionId = sessionId;
    }

    if (status && status !== "ALL") {
      invoiceWhere.status = status.toUpperCase();
    }

    if (search?.trim()) {
      const searchText = search.trim();

      invoiceWhere.OR = [
        {
          invoiceNo: {
            contains: searchText,
            mode: "insensitive",
          },
        },
        {
          invoiceName: {
            contains: searchText,
            mode: "insensitive",
          },
        },
      ];
    }

    // Successful payment filter
    const paymentWhere = {
      status: "SUCCESS",

      invoice: {
        is: {
          schoolId,
          studentId,
          ...(sessionId ? { sessionId } : {}),
        },
      },
    };

    // -----------------------------------------
    // Fetch invoices and summary
    // -----------------------------------------
    const [
      invoices,
      totalRecords,
      invoiceTotals,
      paymentTotal,
    ] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: invoiceWhere,
        skip,
        take: perPage,

        orderBy: [
          {
            dueDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        include: {
          session: {
            select: {
              id: true,
              sessionName: true,
            },
          },

          class: {
            select: {
              id: true,
              className: true,
            },
          },

          section: {
            select: {
              id: true,
              sectionName: true,
            },
          },

          items: {
            orderBy: {
              createdAt: "asc",
            },

            include: {
              feeHead: {
                select: {
                  id: true,
                  feeHeadName: true,
                  frequency: true,
                },
              },
            },
          },

          payments: {
            where: {
              status: "SUCCESS",
            },

            orderBy: {
              paymentDate: "desc",
            },

            include: {
              receipt: true,
            },
          },
        },
      }),

      prisma.feeInvoice.count({
        where: invoiceWhere,
      }),

      prisma.feeInvoice.aggregate({
        where: invoiceWhere,

        _sum: {
          totalAmount: true,
          fineAmount: true,
        },
      }),

      prisma.feePayment.aggregate({
        where: paymentWhere,

        _sum: {
          amount: true,
        },
      }),
    ]);

    // -----------------------------------------
    // Format invoice data
    // -----------------------------------------
    const data = invoices.map((invoice) => {
      const items = invoice.items || [];
      const successfulPayments = invoice.payments || [];

      const paidAmount = successfulPayments.reduce(
        (total, payment) => {
          return total + Number(payment.amount || 0);
        },
        0
      );

      const itemGrossAmount = items.reduce(
        (total, item) => {
          return total + Number(item.amount || 0);
        },
        0
      );

      const discountAmount = items.reduce(
        (total, item) => {
          return total + Number(item.discount || 0);
        },
        0
      );

      const concessionAmount = items.reduce(
        (total, item) => {
          return total + Number(item.concession || 0);
        },
        0
      );

      const itemPayableAmount = items.reduce(
        (total, item) => {
          const amount = Number(item.amount || 0);
          const discount = Number(item.discount || 0);
          const concession = Number(item.concession || 0);

          const payableAmount =
            item.finalAmount !== null &&
            item.finalAmount !== undefined
              ? Number(item.finalAmount)
              : Math.max(
                  amount - discount - concession,
                  0
                );

          return total + payableAmount;
        },
        0
      );

      /*
       * आपके FeeInvoice model में totalAmount available है।
       * यदि totalAmount null है, तो items से payable amount लिया जाएगा।
       */
      const storedTotalAmount =
        invoice.totalAmount !== null &&
        invoice.totalAmount !== undefined
          ? Number(invoice.totalAmount)
          : itemPayableAmount;

      const fineAmount = Number(invoice.fineAmount || 0);

      const finalAmount =
        storedTotalAmount + fineAmount;

      const pendingAmount = Math.max(
        finalAmount - paidAmount,
        0
      );

      let calculatedStatus = invoice.status;

      if (finalAmount > 0 && pendingAmount <= 0) {
        calculatedStatus = "PAID";
      } else if (paidAmount > 0) {
        calculatedStatus = "PARTIALLY_PAID";
      } else if (invoice.status !== "CANCELLED") {
        calculatedStatus = "PENDING";
      }

      return {
        ...invoice,

        status: calculatedStatus,

        grossAmount: itemGrossAmount,
        totalAmount: storedTotalAmount,
        fineAmount,
        discountAmount,
        concessionAmount,
        finalAmount,
        paidAmount,
        pendingAmount,

        items: items.map((item) => {
          const amount = Number(item.amount || 0);
          const discount = Number(item.discount || 0);
          const concession = Number(
            item.concession || 0
          );

          return {
            ...item,

            amount,
            discount,
            concession,

            finalAmount:
              item.finalAmount !== null &&
              item.finalAmount !== undefined
                ? Number(item.finalAmount)
                : Math.max(
                    amount - discount - concession,
                    0
                  ),

            selectedMonths:
              item.selectedMonths || [],
          };
        }),

        payments: successfulPayments.map(
          (payment) => ({
            ...payment,
            amount: Number(payment.amount || 0),
          })
        ),
      };
    });

    // -----------------------------------------
    // Summary
    // -----------------------------------------
    const totalInvoiceAmount = Number(
      invoiceTotals._sum.totalAmount || 0
    );

    const totalFineAmount = Number(
      invoiceTotals._sum.fineAmount || 0
    );

    const totalSuccessfulPayments = Number(
      paymentTotal._sum.amount || 0
    );

    const totalFinalAmount =
      totalInvoiceAmount + totalFineAmount;

    const totalPendingAmount = Math.max(
      totalFinalAmount - totalSuccessfulPayments,
      0
    );

    const totalPages = Math.ceil(
      totalRecords / perPage
    );

    // -----------------------------------------
    // Response
    // -----------------------------------------
    return res.status(200).json({
      success: true,
      message:
        "Student fee invoices fetched successfully.",

      student: {
        ...student,

        fullName: [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" "),
      },

      data,

      summary: {
        totalInvoices: totalRecords,
        totalAmount: totalInvoiceAmount,
        totalFineAmount,
        totalFinalAmount,
        totalPaidAmount: totalSuccessfulPayments,
        totalPendingAmount,
        totalSuccessfulPayments,
      },

      pagination: {
        currentPage,
        perPage,
        totalRecords,
        totalPages,

        prevPage:
          currentPage > 1
            ? currentPage - 1
            : null,

        nextPage:
          currentPage < totalPages
            ? currentPage + 1
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Get student fee invoices error:",
      error
    );

    // Prisma import की आवश्यकता नहीं
    if (
      error?.name ===
      "PrismaClientValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice query.",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message || "Internal server error.",
    });
  }
};