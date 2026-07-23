const PDFDocument = require("pdfkit");
const axios = require("axios");

const COLORS = {
    red: "#DC2626",
    darkRed: "#B91C1C",
    green: "#15803D",
    dark: "#111827",
    gray: "#4B5563",
    lightGreen: "#F0FDF4",
    white: "#FFFFFF",
};

const toNumber = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
};

const formatAmount = (amount) => {
    return `Rs. ${toNumber(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const formatDate = (date) => {
    if (!date) return "-";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    }).format(new Date(date));
};

const getStudentName = (student = {}) => {
    return [
        student.firstName,
        student.middleName,
        student.lastName,
    ]
        .filter(Boolean)
        .join(" ");
};

const parseMonths = (selectedMonths) => {
    if (!selectedMonths) return [];

    if (Array.isArray(selectedMonths)) {
        return selectedMonths;
    }

    if (typeof selectedMonths === "string") {
        try {
            const parsed = JSON.parse(selectedMonths);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return selectedMonths
                .split(",")
                .map((month) => month.trim())
                .filter(Boolean);
        }
    }

    return [];
};

const fetchLogo = async (logoUrl) => {
    if (!logoUrl) return null;

    try {
        const response = await axios.get(logoUrl, {
            responseType: "arraybuffer",
            timeout: 10000,
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error("School logo error:", error.message);
        return null;
    }
};

/*
|--------------------------------------------------------------------------
| Number to words
|--------------------------------------------------------------------------
*/

const numberToWords = (number) => {
    number = Math.floor(toNumber(number));

    if (number === 0) return "Zero";

    const ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];

    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];

    const belowHundred = (num) => {
        if (num < 20) return ones[num];

        return [
            tens[Math.floor(num / 10)],
            ones[num % 10],
        ]
            .filter(Boolean)
            .join(" ");
    };

    const belowThousand = (num) => {
        let words = "";

        if (num >= 100) {
            words += `${ones[Math.floor(num / 100)]} Hundred`;
            num %= 100;

            if (num > 0) words += " ";
        }

        if (num > 0) {
            words += belowHundred(num);
        }

        return words;
    };

    let words = "";

    if (number >= 10000000) {
        words += `${belowThousand(
            Math.floor(number / 10000000)
        )} Crore `;

        number %= 10000000;
    }

    if (number >= 100000) {
        words += `${belowThousand(
            Math.floor(number / 100000)
        )} Lakh `;

        number %= 100000;
    }

    if (number >= 1000) {
        words += `${belowThousand(
            Math.floor(number / 1000)
        )} Thousand `;

        number %= 1000;
    }

    if (number > 0) {
        words += belowThousand(number);
    }

    return words.trim();
};

/*
|--------------------------------------------------------------------------
| PDF generator
|--------------------------------------------------------------------------
*/

const generateFeeReceiptPDF = async (receipt) => {
    const invoice = receipt.invoice;
    const school = invoice.school || {};
    const student = invoice.student || {};
    const payment = invoice.payments?.[0] || receipt.payment || {};

    const items = invoice.items || [];

    const paidAmount = toNumber(payment.amount);

    const pendingAmount = toNumber(invoice.pendingAmount);

    const pageWidth = 390;
    const pageHeight = 650;
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;

    const doc = new PDFDocument({
        size: [pageWidth, pageHeight],
        margin: 0,
        bufferPages: true,
        info: {
            Title: `Fee Receipt ${receipt.receiptNo}`,
            Author: school.name || "School",
        },
    });

    const chunks = [];

    const bufferPromise = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    /*
    |--------------------------------------------------------------------------
    | Outer receipt border
    |--------------------------------------------------------------------------
    */

    doc.rect(
        margin,
        margin,
        contentWidth,
        pageHeight - margin * 2
    )
        .lineWidth(2)
        .strokeColor(COLORS.red)
        .stroke();

    doc.rect(
        margin + 4,
        margin + 4,
        contentWidth - 8,
        pageHeight - margin * 2 - 8
    )
        .lineWidth(0.7)
        .strokeColor(COLORS.green)
        .stroke();

    /*
    |--------------------------------------------------------------------------
    | School header
    |--------------------------------------------------------------------------
    */

    const logoBuffer = await fetchLogo(school.logo);

    if (logoBuffer) {
        try {
            doc.image(logoBuffer, 25, 29, {
                fit: [55, 55],
                align: "center",
                valign: "center",
            });
        } catch (error) {
            console.error("Logo render error:", error.message);
        }
    } else {
        doc.circle(52, 54, 23)
            .fillColor(COLORS.green)
            .fill();

        const initials = (school.name || "SC")
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .slice(0, 2)
            .toUpperCase();

        doc.font("Helvetica-Bold")
            .fontSize(15)
            .fillColor(COLORS.white)
            .text(initials, 29, 47, {
                width: 46,
                align: "center",
            });
    }

    doc.font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(COLORS.red)
        .text(
            (school.name || "School Name").toUpperCase(),
            85,
            27,
            {
                width: 270,
                align: "center",
            }
        );

    const address = [
        school.addressLine,
        school.city,
        school.district,
        school.state,
        school.pincode,
    ]
        .filter(Boolean)
        .join(", ");

    doc.font("Helvetica")
        .fontSize(6.5)
        .fillColor(COLORS.green)
        .text(address || "-", 85, 49, {
            width: 270,
            align: "center",
        });

    const contact = [
        school.phone ? `Mob: ${school.phone}` : null,
        school.email ? `Email: ${school.email}` : null,
    ]
        .filter(Boolean)
        .join(" | ");

    doc.font("Helvetica")
        .fontSize(6.5)
        .fillColor(COLORS.gray)
        .text(contact, 85, 62, {
            width: 270,
            align: "center",
        });

    doc.font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.green)
        .text("FEE RECEIPT", 85, 77, {
            width: 270,
            align: "center",
        });

    doc.moveTo(20, 94)
        .lineTo(pageWidth - 20, 94)
        .lineWidth(1.5)
        .strokeColor(COLORS.red)
        .stroke();

    /*
    |--------------------------------------------------------------------------
    | Receipt details
    |--------------------------------------------------------------------------
    */

    const label = (text, x, y, width = 90) => {
        doc.font("Helvetica")
            .fontSize(6.5)
            .fillColor(COLORS.green)
            .text(text, x, y, { width });
    };

    const value = (text, x, y, width = 120) => {
        doc.font("Helvetica-Bold")
            .fontSize(7.5)
            .fillColor(COLORS.dark)
            .text(text || "-", x, y, { width });
    };

    let y = 103;

    label("Receipt No.", 25, y);
    value(receipt.receiptNo, 25, y + 10, 210);

    label("Date", 250, y);
    value(
        formatDate(payment.paymentDate || receipt.generatedAt),
        250,
        y + 10
    );

    y += 34;

    label("Student Name", 25, y);
    value(getStudentName(student), 25, y + 10, 210);

    label("Admission No.", 250, y);
    value(student.admissionNo, 250, y + 10);

    y += 34;

    const className =
        invoice.class?.className ||
        invoice.class?.name ||
        "-";

    const sectionName =
        invoice.section?.sectionName ||
        invoice.section?.name ||
        "-";

    label("Class", 25, y);
    value(className, 25, y + 10, 100);

    label("Section", 145, y);
    value(sectionName, 145, y + 10, 80);

    label("Roll No.", 250, y);
    value(
        student.rollNo !== null &&
            student.rollNo !== undefined
            ? String(student.rollNo)
            : "-",
        250,
        y + 10
    );

    y += 34;

    label("Payment Mode", 25, y);
    value(payment.paymentMode || "-", 25, y + 10);

    label("Transaction ID", 145, y);
    value(payment.transactionId || "-", 145, y + 10, 110);

    label("Invoice No.", 270, y);
    value(invoice.invoiceNo, 270, y + 10, 95);

    y += 34;

    /*
    |--------------------------------------------------------------------------
    | Fee items table
    |--------------------------------------------------------------------------
    */

    const tableX = 20;
    const tableWidth = pageWidth - 40;

    const serialWidth = 28;
    const descriptionWidth = 213;
    const amountWidth = tableWidth -
        serialWidth -
        descriptionWidth;

    const headerHeight = 23;

    doc.rect(tableX, y, tableWidth, headerHeight)
        .fillColor(COLORS.red)
        .fill();

    doc.font("Helvetica-Bold")
        .fontSize(7)
        .fillColor(COLORS.white)
        .text("S.No.", tableX + 3, y + 8, {
            width: serialWidth - 6,
            align: "center",
        })
        .text(
            "Particulars",
            tableX + serialWidth + 5,
            y + 8,
            {
                width: descriptionWidth - 10,
            }
        )
        .text(
            "Amount",
            tableX +
                serialWidth +
                descriptionWidth +
                3,
            y + 8,
            {
                width: amountWidth - 6,
                align: "right",
            }
        );

    y += headerHeight;

    let displayedItems = items;

    // Compact receipt me maximum 8 rows
    if (items.length > 8) {
        displayedItems = items.slice(0, 8);
    }

    displayedItems.forEach((item, index) => {
        const months = parseMonths(item.selectedMonths);

        const feeHeadName =
            item.feeHead?.feeHeadName ||
            item.feeHead?.name ||
            "Fee";

        const description =
            months.length > 0
                ? `${feeHeadName} (${months.join(", ")})`
                : feeHeadName;

        const rowHeight = 25;

        if (index % 2 === 0) {
            doc.rect(tableX, y, tableWidth, rowHeight)
                .fillColor(COLORS.lightGreen)
                .fill();
        }

        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.dark)
            .text(
                String(index + 1),
                tableX + 3,
                y + 8,
                {
                    width: serialWidth - 6,
                    align: "center",
                }
            )
            .text(
                description,
                tableX + serialWidth + 5,
                y + 8,
                {
                    width: descriptionWidth - 10,
                    ellipsis: true,
                }
            )
            .text(
                formatAmount(item.finalAmount),
                tableX +
                    serialWidth +
                    descriptionWidth +
                    3,
                y + 8,
                {
                    width: amountWidth - 6,
                    align: "right",
                }
            );

        doc.moveTo(tableX, y + rowHeight)
            .lineTo(tableX + tableWidth, y + rowHeight)
            .lineWidth(0.5)
            .strokeColor(COLORS.green)
            .stroke();

        y += rowHeight;
    });

    if (items.length === 0) {
        doc.font("Helvetica")
            .fontSize(7)
            .fillColor(COLORS.gray)
            .text("No fee particulars found", tableX, y + 9, {
                width: tableWidth,
                align: "center",
            });

        y += 28;
    }

    if (items.length > 8) {
        doc.font("Helvetica-Oblique")
            .fontSize(6.5)
            .fillColor(COLORS.gray)
            .text(
                `+ ${items.length - 8} additional fee items`,
                tableX + 5,
                y + 5
            );

        y += 18;
    }

    /*
    |--------------------------------------------------------------------------
    | Table vertical borders
    |--------------------------------------------------------------------------
    */

    const tableBottom = y;

    doc.moveTo(tableX, y - displayedItems.length * 25 - 23)
        .lineTo(tableX, tableBottom)
        .strokeColor(COLORS.red)
        .stroke();

    doc.moveTo(tableX + serialWidth, y - displayedItems.length * 25 - 23)
        .lineTo(tableX + serialWidth, tableBottom)
        .stroke();

    doc.moveTo(
        tableX + serialWidth + descriptionWidth,
        y - displayedItems.length * 25 - 23
    )
        .lineTo(
            tableX + serialWidth + descriptionWidth,
            tableBottom
        )
        .stroke();

    doc.moveTo(tableX + tableWidth, y - displayedItems.length * 25 - 23)
        .lineTo(tableX + tableWidth, tableBottom)
        .stroke();

    /*
    |--------------------------------------------------------------------------
    | Payment summary
    |--------------------------------------------------------------------------
    */

    const totalLabelWidth =
        serialWidth + descriptionWidth;

    const summaryRow = (
        rowLabel,
        rowValue,
        options = {}
    ) => {
        const rowHeight = options.height || 23;

        if (options.fill) {
            doc.rect(tableX, y, tableWidth, rowHeight)
                .fillColor(options.fill)
                .fill();
        }

        doc.font("Helvetica-Bold")
            .fontSize(options.fontSize || 7.5)
            .fillColor(
                options.textColor || COLORS.dark
            )
            .text(
                rowLabel,
                tableX + 5,
                y + 8,
                {
                    width: totalLabelWidth - 10,
                    align: "right",
                }
            )
            .text(
                rowValue,
                tableX + totalLabelWidth + 3,
                y + 8,
                {
                    width: amountWidth - 6,
                    align: "right",
                }
            );

        doc.rect(tableX, y, tableWidth, rowHeight)
            .lineWidth(0.6)
            .strokeColor(COLORS.red)
            .stroke();

        doc.moveTo(tableX + totalLabelWidth, y)
            .lineTo(
                tableX + totalLabelWidth,
                y + rowHeight
            )
            .stroke();

        y += rowHeight;
    };

    summaryRow(
        "Invoice Total",
        formatAmount(invoice.totalAmount)
    );

    summaryRow(
        "Paid Now",
        formatAmount(paidAmount),
        {
            fill: COLORS.green,
            textColor: COLORS.white,
            fontSize: 8,
        }
    );

    summaryRow(
        "Pending Amount",
        formatAmount(pendingAmount),
        {
            textColor:
                pendingAmount > 0
                    ? COLORS.red
                    : COLORS.green,
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Amount in words
    |--------------------------------------------------------------------------
    */

    y += 10;

    doc.font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(COLORS.green)
        .text("Rupees in words:", 25, y);

    doc.font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.dark)
        .text(
            `${numberToWords(paidAmount)} Rupees Only`,
            90,
            y,
            {
                width: 270,
            }
        );

    y += 35;

    /*
    |--------------------------------------------------------------------------
    | Signatures
    |--------------------------------------------------------------------------
    */

    doc.moveTo(25, y)
        .lineTo(115, y)
        .strokeColor(COLORS.green)
        .stroke();

    doc.moveTo(pageWidth - 115, y)
        .lineTo(pageWidth - 25, y)
        .stroke();

    doc.font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(COLORS.green)
        .text("Sign. of Collector", 25, y + 5, {
            width: 90,
            align: "center",
        })
        .text(
            "Authorized Signature",
            pageWidth - 115,
            y + 5,
            {
                width: 90,
                align: "center",
            }
        );

    y += 28;

    doc.font("Helvetica")
        .fontSize(5.8)
        .fillColor(COLORS.gray)
        .text(
            "This is a computer-generated fee receipt.",
            25,
            y,
            {
                width: pageWidth - 50,
                align: "center",
            }
        );

    doc.end();

    return bufferPromise;
};

module.exports = {
    generateFeeReceiptPDF,
};