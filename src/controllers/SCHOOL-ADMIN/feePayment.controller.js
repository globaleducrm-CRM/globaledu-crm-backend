const { PrismaClient } = require('@prisma/client');
const { getPaginationMeta, getPagination } = require('../../utils/pagination');

const prisma = new PrismaClient();

exports.store = async (req, res) => {
    try {
        const {
            invoiceId,
            amount,
            paymentMode,
            paymentDate,
            transactionId,
            remarks,
        } = req.body;

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
                            items: true,
                        },
                    });

                if (!invoice) {
                    throw new Error(
                        "Invoice not found."
                    );
                }

                // 1. Create payment
                const payment =
                    await tx.feePayment.create({
                        data: {
                            invoiceId,
                            amount: Number(amount),
                            paymentMode,
                            paymentDate:
                                paymentDate
                                    ? new Date(
                                          paymentDate
                                      )
                                    : new Date(),
                            transactionId:
                                transactionId ||
                                null,
                            remarks:
                                remarks || null,
                            status: "SUCCESS",
                        },
                    });

                // 2. Create receipt
                const receiptNo =
                    `REC-${invoice.invoiceNo}-${payment.id
                        .replace(/-/g, "")
                        .slice(-8)
                        .toUpperCase()}`;

                const receipt =
                    await tx.feeReceipt.create({
                        data: {
                            invoiceId,
                            paymentId:
                                payment.id,
                            receiptNo,
                        },
                    });

                // 3. Fresh invoice/payment data
                const refreshedInvoice =
                    await tx.feeInvoice.findUnique({
                        where: {
                            id: invoiceId,
                        },
                        include: {
                            items: true,
                            payments: {
                                where: {
                                    status:
                                        "SUCCESS",
                                },
                            },
                        },
                    });

                // Net amount after concession
                const netAmount =
                    refreshedInvoice.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.finalAmount ||
                                    0
                            ),
                        0
                    );

                const totalConcession =
                    refreshedInvoice.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.concession ||
                                    0
                            ),
                        0
                    );

                const totalPaid =
                    refreshedInvoice.payments.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.amount || 0
                            ),
                        0
                    );

                const fineAmount = Number(
                    refreshedInvoice.fineAmount ||
                        0
                );

                const pendingAmount = Math.max(
                    netAmount +
                        fineAmount -
                        totalPaid,
                    0
                );

                const status =
                    pendingAmount <= 0
                        ? "PAID"
                        : totalPaid > 0
                            ? "PARTIAL"
                            : "PENDING";

                // 4. Update invoice
                const updatedInvoice =
                    await tx.feeInvoice.update({
                        where: {
                            id: invoiceId,
                        },
                        data: {
                            totalAmount:
                                netAmount,
                            discountAmount:
                                totalConcession,
                            paidAmount:
                                totalPaid,
                            pendingAmount,
                            status,
                        },
                    });

                return {
                    payment,
                    receipt,
                    invoice:
                        updatedInvoice,
                };
            }
        );

        return res.status(201).json({
            success: true,
            message:
                "Payment received and receipt generated successfully.",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.index = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;

    const {
      invoiceId,
      studentId,
      dateFrom,
      dateTo,
      paymentMode,
      status = "SUCCESS",
    } = req.query;

    if (!schoolId) {
      return res.status(403).json({
        success: false,
        message: "School access is required.",
      });
    }

    const { page, limit, skip } = getPagination(req);

    // --------------------------------------------------
    // Date validation
    // --------------------------------------------------
    const isValidDateOnly = (value) => {
      if (!value) return true;

      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

      if (!match) return false;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const date = new Date(Date.UTC(year, month - 1, day));

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    };

    if (!isValidDateOnly(dateFrom)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Date From. Format YYYY-MM-DD hona chahiye.",
      });
    }

    if (!isValidDateOnly(dateTo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Date To. Format YYYY-MM-DD hona chahiye.",
      });
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({
        success: false,
        message: "Date From, Date To se greater nahi ho sakti.",
      });
    }

    // India timezone boundaries
    const startDate = dateFrom
      ? new Date(`${dateFrom}T00:00:00.000+05:30`)
      : null;

    let endDateExclusive = null;

    if (dateTo) {
      endDateExclusive = new Date(
        `${dateTo}T00:00:00.000+05:30`
      );

      endDateExclusive.setUTCDate(
        endDateExclusive.getUTCDate() + 1
      );
    }

    // --------------------------------------------------
    // Common filter
    // --------------------------------------------------
    const where = {
      invoice: {
        is: {
          schoolId,
          ...(studentId ? { studentId } : {}),
        },
      },
    };

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (status && status.toUpperCase() !== "ALL") {
      where.status = status.toUpperCase();
    }

    if (
      paymentMode &&
      paymentMode.toUpperCase() !== "ALL"
    ) {
      where.paymentMode = paymentMode.toUpperCase();
    }

    if (startDate || endDateExclusive) {
      where.paymentDate = {};

      if (startDate) {
        where.paymentDate.gte = startDate;
      }

      if (endDateExclusive) {
        where.paymentDate.lt = endDateExclusive;
      }
    }

    // --------------------------------------------------
    // Main queries
    // --------------------------------------------------
    const [
      payments,
      total,
      amountSummary,
      availableModes,
    ] = await Promise.all([
      prisma.feePayment.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          { paymentDate: "desc" },
          { createdAt: "desc" },
        ],

        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              invoiceName: true,
              totalAmount: true,
              fineAmount: true,

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
          },

          receipt: true,
        },
      }),

      prisma.feePayment.count({
        where,
      }),

      prisma.feePayment.aggregate({
        where,
        _sum: {
          amount: true,
        },
      }),

      // केवल available payment modes निकालें
      prisma.feePayment.findMany({
        where,
        select: {
          paymentMode: true,
        },
        distinct: ["paymentMode"],
      }),
    ]);

    // --------------------------------------------------
    // groupBy की जगह separate aggregate queries
    // --------------------------------------------------
    const modeSummaryResults = await Promise.all(
      availableModes.map(async ({ paymentMode: mode }) => {
        const modeWhere = {
          ...where,
          paymentMode: mode,
        };

        const [aggregate, transactionCount] =
          await Promise.all([
            prisma.feePayment.aggregate({
              where: modeWhere,
              _sum: {
                amount: true,
              },
            }),

            prisma.feePayment.count({
              where: modeWhere,
            }),
          ]);

        return {
          paymentMode: mode,
          amount: Number(aggregate._sum.amount || 0),
          transactions: transactionCount,
        };
      })
    );

    const modeWise = {};

    modeSummaryResults.forEach((item) => {
      modeWise[item.paymentMode] = {
        amount: item.amount,
        transactions: item.transactions,
      };
    });

    // --------------------------------------------------
    // Format payments
    // --------------------------------------------------
    const data = payments.map((payment) => {
      const student = payment.invoice?.student;

      return {
        ...payment,

        amount: Number(payment.amount || 0),

        invoice: payment.invoice
          ? {
              ...payment.invoice,

              totalAmount: Number(
                payment.invoice.totalAmount || 0
              ),

              fineAmount: Number(
                payment.invoice.fineAmount || 0
              ),

              student: student
                ? {
                    ...student,

                    fullName: [
                      student.firstName,
                      student.middleName,
                      student.lastName,
                    ]
                      .filter(Boolean)
                      .join(" "),
                  }
                : null,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Fee payments fetched successfully.",

      data,

      summary: {
        totalCollection: Number(
          amountSummary._sum.amount || 0
        ),

        totalTransactions: total,

        modeWise,
      },

      filters: {
        invoiceId: invoiceId || null,
        studentId: studentId || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        paymentMode: paymentMode || "ALL",
        status: status || "SUCCESS",
      },

      pagination: getPaginationMeta(
        page,
        limit,
        total
      ),
    });
  } catch (error) {
    console.error("Get fee payments error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Fee payments fetch nahi hui.",
    });
  }
};
