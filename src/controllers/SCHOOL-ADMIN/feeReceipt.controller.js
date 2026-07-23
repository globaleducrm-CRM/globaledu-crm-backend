const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const {
    generateFeeReceiptPDF,
} = require("../../utils/generateFeeReceiptPDF");


const prisma = new PrismaClient();

const numberToWords = (amount) => {
  if (typeof amount !== 'number') amount = Number(amount);
  if (Number.isNaN(amount)) return 'zero';

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const convert = (num) => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ` ${ones[num % 10]}` : '');
    if (num < 1000) return `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` ${convert(num % 100)}` : ''}`;
    if (num < 1000000) return `${convert(Math.floor(num / 1000))} thousand${num % 1000 ? ` ${convert(num % 1000)}` : ''}`;
    if (num < 1000000000) return `${convert(Math.floor(num / 1000000))} million${num % 1000000 ? ` ${convert(num % 1000000)}` : ''}`;
    return `${convert(Math.floor(num / 1000000000))} billion${num % 1000000000 ? ` ${convert(num % 1000000000)}` : ''}`;
  };

  const [integerPart, decimalPart] = Math.abs(amount).toFixed(2).split('.');
  const words = `${convert(Number(integerPart))} rupees${decimalPart && Number(decimalPart) ? ` and ${convert(Number(decimalPart))} paise` : ''}`;
  return amount < 0 ? `minus ${words}` : words;
};

const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

exports.downloadReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const invoice = await prisma.feeInvoice.findFirst({
      where: { id, schoolId },
      include: {
        school: {
          select: {
            name: true,
            addressLine: true,
            city: true,
            state: true,
            pincode: true,
            email: true,
            phone: true,
          },
        },
        student: {
          select: {
            admissionNo: true,
            firstName: true,
            lastName: true,
            rollNo: true,
            city: true,
            state: true,
            pincode: true,
          },
        },
        class: {
          select: { sortName: true },
        },
        section: {
          select: { sectionName: true },
        },
        session: {
          select: { sessionName: true },
        },
        items: {
          include: {
            feeHead: {
              select: { feeHeadName: true, frequency: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
        },
        receipt: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    let receipt = invoice.receipt;
    if (!receipt) {
      const receiptNo = `RCPT-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
      receipt = await prisma.feeReceipt.create({ data: { invoiceId: invoice.id, receiptNo } });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNo}.pdf"`);

    doc.pipe(res);

    const schoolName = invoice.school?.name || 'School';
    const schoolAddress = [invoice.school?.addressLine, invoice.school?.city, invoice.school?.state, invoice.school?.pincode].filter(Boolean).join(', ');

    doc.fontSize(18).text(schoolName, { align: 'center' });
    doc.fontSize(10).text(schoolAddress, { align: 'center' });
    doc.text(`Email: ${invoice.school?.email || '-'}`, { align: 'center' });
    doc.text(`Phone: ${invoice.school?.phone || '-'}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(14).text('Fee Receipt', { align: 'center', underline: true });
    doc.moveDown(1);

    const topLeft = 40;
    const detailsLeft = 250;

    doc.fontSize(10).text(`Receipt No: ${receipt.receiptNo}`, topLeft);
    doc.text(`Receipt Date: ${new Date().toLocaleDateString()}`, topLeft);
    doc.text(`Invoice No: ${invoice.invoiceNo}`, topLeft);
    doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, topLeft);
    doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}`, topLeft);

    doc.fontSize(10).text(`Student Name: ${invoice.student?.firstName || ''} ${invoice.student?.lastName || ''}`, detailsLeft);
    doc.text(`Admission No: ${invoice.student?.admissionNo || '-'}`, detailsLeft);
    doc.text(`Roll No: ${invoice.student?.rollNo || '-'}`, detailsLeft);
    doc.text(`Class: ${invoice.class?.sortName || '-'}`, detailsLeft);
    doc.text(`Section: ${invoice.section?.sectionName || '-'}`, detailsLeft);
    doc.text(`Session: ${invoice.session?.sessionName || '-'}`, detailsLeft);
    doc.moveDown(1);

    doc.fontSize(12).text('Fee Details', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const columnPositions = {
      feeHead: 40,
      frequency: 220,
      months: 320,
      amount: 460,
    };

    doc.fontSize(10).text('Fee Head', columnPositions.feeHead, tableTop, { bold: true });
    doc.text('Frequency', columnPositions.frequency, tableTop);
    doc.text('Months', columnPositions.months, tableTop);
    doc.text('Amount', columnPositions.amount, tableTop, { width: 100, align: 'right' });
    doc.moveDown(0.75);

    invoice.items.forEach((item) => {
      const y = doc.y;
      const monthsText = Array.isArray(item.selectedMonths) ? item.selectedMonths.join(', ') : '-';
      doc.text(item.feeHead?.feeHeadName || '-', columnPositions.feeHead, y, { width: 180 });
      doc.text(item.feeHead?.frequency || '-', columnPositions.frequency, y, { width: 90 });
      doc.text(monthsText, columnPositions.months, y, { width: 120 });
      doc.text(`₹ ${formatCurrency(item.amount)}`, columnPositions.amount, y, { width: 100, align: 'right' });
      doc.moveDown(0.75);
    });

    doc.moveDown(0.5);
    doc.fontSize(10).text(`Total Amount: ₹ ${formatCurrency(invoice.totalAmount)}`, { align: 'right' });
    doc.text(`Discount: ₹ ${formatCurrency(invoice.discountAmount)}`, { align: 'right' });
    doc.text(`Fine: ₹ ${formatCurrency(invoice.fineAmount)}`, { align: 'right' });
    doc.text(`Paid Amount: ₹ ${formatCurrency(invoice.paidAmount)}`, { align: 'right' });
    doc.text(`Pending Amount: ₹ ${formatCurrency(invoice.pendingAmount)}`, { align: 'right' });
    doc.moveDown(0.75);

    doc.fontSize(10).text(`Amount in Words: ${numberToWords(Number(invoice.totalAmount))} only.`, { align: 'left' });
    doc.moveDown(0.75);

    if (invoice.payments.length) {
      doc.fontSize(12).text('Payment History', { underline: true });
      doc.moveDown(0.5);

      const payCol = { date: 40, mode: 150, amount: 300, transactionId: 390, remarks: 490 };
      doc.fontSize(10).text('Date', payCol.date, doc.y);
      doc.text('Mode', payCol.mode, doc.y);
      doc.text('Amount', payCol.amount, doc.y, { width: 90, align: 'right' });
      doc.text('Transaction', payCol.transactionId, doc.y);
      doc.moveDown(0.75);

      invoice.payments.forEach((payment) => {
        const y = doc.y;
        doc.text(new Date(payment.paymentDate).toLocaleDateString(), payCol.date, y);
        doc.text(payment.paymentMode, payCol.mode, y);
        doc.text(`₹ ${formatCurrency(payment.amount)}`, payCol.amount, y, { width: 90, align: 'right' });
        doc.text(payment.transactionId || '-', payCol.transactionId, y, { width: 100 });
        doc.moveDown(0.75);
      });
    }

    doc.moveDown(1);
    doc.fontSize(10).text('Thank you for your payment.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};



exports.receipts = async (req, res) => {
    try {
        const { studentId } = req.params;

        const {
            page = 1,
            limit = 10,
            sessionId,
            classId,
            sectionId,
            paymentMode,
            dateFrom,
            dateTo,
            search,
        } = req.query;

        const schoolId = req.user.schoolId;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: "Student ID is required.",
            });
        }

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
        // Invoice filters
        // ==========================================
        const invoiceWhere = {
            schoolId,
            studentId,
        };

        if (sessionId) {
            invoiceWhere.sessionId = sessionId;
        }

        if (classId) {
            invoiceWhere.classId = classId;
        }

        if (sectionId) {
            invoiceWhere.sectionId = sectionId;
        }

        // ==========================================
        // Fee payment filters
        // ==========================================
        const where = {
            status: "SUCCESS",

            invoice: {
                is: invoiceWhere,
            },

            AND: [],
        };

        if (paymentMode) {
            where.paymentMode = paymentMode;
        }

        // ==========================================
        // Payment date filters
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
                paymentDate: {
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
                paymentDate: {
                    lte: parsedDateTo,
                },
            });
        }

        // ==========================================
        // Search
        // ==========================================
        if (search?.trim()) {
            const searchTerm = search.trim();

            where.AND.push({
                OR: [
                    {
                        transactionId: {
                            contains: searchTerm,
                            mode: "insensitive",
                        },
                    },
                    {
                        remarks: {
                            contains: searchTerm,
                            mode: "insensitive",
                        },
                    },
                    {
                        invoice: {
                            is: {
                                invoiceNo: {
                                    contains: searchTerm,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        invoice: {
                            is: {
                                invoiceName: {
                                    contains: searchTerm,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },

                    // FeeInvoice has multiple receipts,
                    // therefore use `some`
                    {
                        invoice: {
                            is: {
                                receipts: {
                                    some: {
                                        receiptNo: {
                                            contains: searchTerm,
                                            mode: "insensitive",
                                        },
                                    },
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
        // Get payments and total count
        // ==========================================
        const [totalRecords, payments] =
            await prisma.$transaction([
                prisma.feePayment.count({
                    where,
                }),

                prisma.feePayment.findMany({
                    where,

                    include: {
                        invoice: {
                            include: {
                                // Correct relation name
                                receipts: {
                                    select: {
                                        id: true,
                                        receiptNo: true,
                                        paymentId: true,
                                        generatedAt: true,
                                    },
                                    orderBy: {
                                        generatedAt: "desc",
                                    },
                                },

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
                            },
                        },
                    },

                    orderBy: {
                        paymentDate: "desc",
                    },

                    skip,
                    take: perPage,
                }),
            ]);

        // ==========================================
        // Format receipts and allocation
        // ==========================================
        const receiptsWithAllocation = payments.map(
            (payment) => {
                const paymentAmount = Number(
                    payment.amount || 0
                );

                const invoiceItems =
                    payment.invoice?.items || [];

                // Concession ke baad item payable amount
                const formattedItems = invoiceItems.map(
                    (item) => {
                        const amount = Number(
                            item.amount || 0
                        );

                        const concession = Number(
                            item.concession || 0
                        );

                        const finalAmount =
                            item.finalAmount !== null &&
                            item.finalAmount !== undefined
                                ? Number(
                                      item.finalAmount
                                  )
                                : Math.max(
                                      amount -
                                          concession,
                                      0
                                  );

                        return {
                            ...item,
                            amount,
                            concession,
                            specialDiscount:
                                concession,
                            finalAmount,
                        };
                    }
                );

                const invoiceFinalAmount =
                    formattedItems.reduce(
                        (sum, item) =>
                            sum + item.finalAmount,
                        0
                    );

                let remainingPayment =
                    paymentAmount;

                const paymentAllocation =
                    formattedItems.map(
                        (item, index) => {
                            let allocatedAmount = 0;

                            if (
                                invoiceFinalAmount > 0 &&
                                paymentAmount > 0
                            ) {
                                if (
                                    index ===
                                    formattedItems.length -
                                        1
                                ) {
                                    // Last item receives rounding
                                    // remainder
                                    allocatedAmount =
                                        Math.max(
                                            remainingPayment,
                                            0
                                        );
                                } else {
                                    const proportion =
                                        item.finalAmount /
                                        invoiceFinalAmount;

                                    allocatedAmount =
                                        Math.round(
                                            paymentAmount *
                                                proportion *
                                                100
                                        ) / 100;

                                    allocatedAmount =
                                        Math.min(
                                            allocatedAmount,
                                            remainingPayment
                                        );

                                    remainingPayment -=
                                        allocatedAmount;
                                }
                            }

                            return {
                                feeHeadId:
                                    item.feeHeadId,

                                feeHeadName:
                                    item.feeHead
                                        ?.feeHeadName ||
                                    "Unknown",

                                grossAmount:
                                    item.amount,

                                concession:
                                    item.concession,

                                specialDiscount:
                                    item.concession,

                                payableAmount:
                                    item.finalAmount,

                                allocatedAmount:
                                    Math.round(
                                        allocatedAmount *
                                            100
                                    ) / 100,

                                selectedMonths:
                                    item.selectedMonths ||
                                    [],
                            };
                        }
                    );

                // Current payment ki receipt
                const currentReceipt =
                    payment.invoice?.receipts?.find(
                        (receipt) =>
                            receipt.paymentId ===
                            payment.id
                    ) || null;

                return {
                    ...payment,

                    amount: paymentAmount,

                    receipt: currentReceipt,

                    paymentAllocation,

                    summary: {
                        invoiceGrossAmount:
                            formattedItems.reduce(
                                (sum, item) =>
                                    sum + item.amount,
                                0
                            ),

                        concessionAmount:
                            formattedItems.reduce(
                                (sum, item) =>
                                    sum +
                                    item.concession,
                                0
                            ),

                        invoiceFinalAmount,

                        paymentAmount,
                    },
                };
            }
        );

        const totalPages = Math.ceil(
            totalRecords / perPage
        );

        return res.status(200).json({
            success: true,
            message:
                "Student fee receipts fetched successfully.",

            total: totalRecords,

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

            data: receiptsWithAllocation,
        });
    } catch (error) {
        console.error(
            "Error fetching receipts:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to fetch student receipts.",
            stack:
                process.env.NODE_ENV === "development"
                    ? error.stack
                    : undefined,
        });
    }
};

exports.repairHalfYearlyInvoice = async (
    req,
    res
) => {
    try {
        const { invoiceId } = req.params;
        const schoolId = req.user.schoolId;

        const result = await prisma.$transaction(
            async (tx) => {
                const invoice =
                    await tx.feeInvoice.findFirst({
                        where: {
                            id: invoiceId,
                            schoolId,
                        },
                        include: {
                            items: {
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
                            },
                        },
                    });

                if (!invoice) {
                    throw new Error(
                        "Invoice not found."
                    );
                }

                const monthCount = Math.max(
                    ...invoice.items.map(
                        (item) =>
                            item.selectedMonths
                                ?.length || 0
                    ),
                    1
                );

                let invoiceGrossAmount = 0;
                let invoiceConcession = 0;
                let invoiceFinalAmount = 0;

                const repairedItems = [];

                for (const item of invoice.items) {
                    const frequency =
                        item.feeHead?.frequency ||
                        "ONE_TIME";

                    let multiplier = 1;

                    switch (frequency) {
                        case "MONTHLY":
                            multiplier = monthCount;
                            break;

                        case "QUARTERLY":
                            multiplier = Math.ceil(
                                monthCount / 3
                            );
                            break;

                        case "HALF_YEARLY":
                            multiplier = Math.ceil(
                                monthCount / 6
                            );
                            break;

                        case "YEARLY":
                            multiplier = Math.ceil(
                                monthCount / 12
                            );
                            break;

                        case "ONE_TIME":
                        default:
                            multiplier = 1;
                            break;
                    }

                    /*
                     * Important:
                     * Ye repair old invoices ke liye hai jahan
                     * item.amount unit amount ke roop mein save hai.
                     * Is API ko same invoice par dobara run mat karein.
                     */
                    const unitAmount = Number(
                        item.amount || 0
                    );

                    const unitConcession = Number(
                        item.concession || 0
                    );

                    const correctedAmount =
                        unitAmount * multiplier;

                    const correctedConcession =
                        unitConcession * multiplier;

                    const correctedFinalAmount =
                        Math.max(
                            correctedAmount -
                                correctedConcession,
                            0
                        );

                    const correctedMonths =
                        frequency === "ONE_TIME"
                            ? (
                                  item.selectedMonths ||
                                  []
                              ).slice(0, 1)
                            : item.selectedMonths || [];

                    await tx.feeInvoiceItem.update({
                        where: {
                            id: item.id,
                        },
                        data: {
                            amount:
                                correctedAmount,
                            concession:
                                correctedConcession,
                            finalAmount:
                                correctedFinalAmount,
                            selectedMonths:
                                correctedMonths,
                        },
                    });

                    invoiceGrossAmount +=
                        correctedAmount;

                    invoiceConcession +=
                        correctedConcession;

                    invoiceFinalAmount +=
                        correctedFinalAmount;

                    repairedItems.push({
                        id: item.id,
                        feeHeadName:
                            item.feeHead
                                ?.feeHeadName,
                        frequency,
                        multiplier,
                        amount:
                            correctedAmount,
                        concession:
                            correctedConcession,
                        finalAmount:
                            correctedFinalAmount,
                        selectedMonths:
                            correctedMonths,
                    });
                }

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
                    invoiceFinalAmount +
                        fineAmount -
                        paidAmount,
                    0
                );

                const invoiceStatus =
                    pendingAmount <= 0
                        ? "PAID"
                        : paidAmount > 0
                            ? "PARTIAL"
                            : "PENDING";

                const updatedInvoice =
                    await tx.feeInvoice.update({
                        where: {
                            id: invoice.id,
                        },
                        data: {
                            totalAmount:
                                invoiceFinalAmount,
                            paidAmount,
                            pendingAmount,
                            status:
                                invoiceStatus,
                        },
                    });

                // Update complete batch totals
                if (invoice.batchId) {
                    const batchInvoices =
                        await tx.feeInvoice.findMany(
                            {
                                where: {
                                    batchId:
                                        invoice.batchId,
                                },
                                select: {
                                    totalAmount:
                                        true,
                                    paidAmount: true,
                                    pendingAmount:
                                        true,
                                },
                            }
                        );

                    const batchTotal =
                        batchInvoices.reduce(
                            (sum, item) =>
                                sum +
                                Number(
                                    item.totalAmount ||
                                        0
                                ),
                            0
                        );

                    const batchPaid =
                        batchInvoices.reduce(
                            (sum, item) =>
                                sum +
                                Number(
                                    item.paidAmount ||
                                        0
                                ),
                            0
                        );

                    const batchPending =
                        batchInvoices.reduce(
                            (sum, item) =>
                                sum +
                                Number(
                                    item.pendingAmount ||
                                        0
                                ),
                            0
                        );

                    await tx.feeInvoiceBatch.update({
                        where: {
                            id: invoice.batchId,
                        },
                        data: {
                            totalAmount:
                                batchTotal,
                            paidAmount:
                                batchPaid,
                            pendingAmount:
                                batchPending,
                            status:
                                batchPending <= 0
                                    ? "PAID"
                                    : batchPaid > 0
                                        ? "PARTIAL"
                                        : "PENDING",
                        },
                    });
                }

                return {
                    invoice:
                        updatedInvoice,
                    items: repairedItems,
                    summary: {
                        grossAmount:
                            invoiceGrossAmount,
                        concessionAmount:
                            invoiceConcession,
                        finalAmount:
                            invoiceFinalAmount,
                        paidAmount,
                        pendingAmount,
                        status:
                            invoiceStatus,
                    },
                };
            }
        );

        return res.status(200).json({
            success: true,
            message:
                "Half-yearly invoice repaired successfully.",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


exports.downloadFeeReceiptPDF = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const schoolId = req.user.schoolId;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required.",
            });
        }

        if (!schoolId) {
            return res.status(403).json({
                success: false,
                message: "School information not found.",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | FeePayment find karein
        |--------------------------------------------------------------------------
        */

        const payment = await prisma.feePayment.findFirst({
            where: {
                id: paymentId,

                invoice: {
                    is: {
                        schoolId,
                    },
                },
            },

            include: {
                invoice: {
                    include: {
                        school: true,
                        student: true,
                        session: true,
                        class: true,
                        section: true,

                        items: {
                            include: {
                                feeHead: true,
                            },

                            orderBy: {
                                createdAt: "asc",
                            },
                        },
                    },
                },
            },
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Fee payment not found.",
            });
        }

        if (payment.status !== "SUCCESS") {
            return res.status(400).json({
                success: false,
                message:
                    "Receipt can only be generated for a successful payment.",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Receipt number
        |--------------------------------------------------------------------------
        */

        const shortPaymentId = payment.id
            .replaceAll("-", "")
            .slice(-8)
            .toUpperCase();

        const receiptNumber =
            `REC-${payment.invoice.invoiceNo}-${shortPaymentId}`;

        /*
        |--------------------------------------------------------------------------
        | Har payment ki separate receipt create/reuse hogi
        |--------------------------------------------------------------------------
        */

        const receipt = await prisma.feeReceipt.upsert({
            where: {
                paymentId: payment.id,
            },

            update: {},

            create: {
                invoiceId: payment.invoiceId,
                paymentId: payment.id,
                receiptNo: receiptNumber,
                generatedAt: payment.paymentDate,
            },

            include: {
                payment: true,

                invoice: {
                    include: {
                        school: true,
                        student: true,
                        session: true,
                        class: true,
                        section: true,

                        items: {
                            include: {
                                feeHead: true,
                            },

                            orderBy: {
                                createdAt: "asc",
                            },
                        },
                    },
                },
            },
        });

        /*
        |--------------------------------------------------------------------------
        | Generator ko current payment provide karein
        |--------------------------------------------------------------------------
        |
        | Is PDF me current FeePayment ka:
        | - amount
        | - mode
        | - transactionId
        | - paymentDate
        | show hoga.
        */

        const pdfReceiptData = {
            ...receipt,

            invoice: {
                ...receipt.invoice,

                // Sirf current payment receipt me show hoga
                payments: [receipt.payment],
            },
        };

        const pdfBuffer =
            await generateFeeReceiptPDF(pdfReceiptData);

        const safeReceiptNo = receipt.receiptNo.replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
        );

        const filename =
            `Fee-Receipt-${safeReceiptNo}.pdf`;

        res.setHeader("Content-Type", "application/pdf");

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        res.setHeader(
            "Content-Length",
            pdfBuffer.length
        );

        return res.status(200).send(pdfBuffer);
    } catch (error) {
        console.error(
            "Fee receipt PDF error:",
            error
        );

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message:
                    "Receipt already exists for this payment.",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Fee receipt PDF generation failed.",
        });
    }
};