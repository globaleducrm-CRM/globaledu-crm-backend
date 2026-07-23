const axios = require("axios");
const sharp = require("sharp");
const QRCode = require("qrcode");
const bwipjs = require("bwip-js");

const mm = (value) => Number(value || 0) * 2.834645669;

const normalizeHexColor = (color, fallback = "#111827") => {
  const value = String(color || "").trim();

  return /^#[0-9A-F]{6}$/i.test(value)
    ? value
    : fallback;
};

const parseJsonConfig = (config) => {
  if (!config) return {};

  if (
    typeof config === "object" &&
    !Array.isArray(config)
  ) {
    return config;
  }

  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
};

const normalizeFields = (fields) => {
  if (!Array.isArray(fields)) return [];

  return fields
    .map((field) => {
      if (typeof field === "string") {
        return field;
      }

      return (
        field?.field ||
        field?.key ||
        field?.value ||
        field?.name
      );
    })
    .filter(Boolean)
    .map((field) =>
      String(field).trim().toUpperCase()
    );
};

const getFullName = (student = {}) => {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getSchoolAddress = (school = {}) => {
  return [
    school.addressLine,
    school.city,
    school.district,
    school.state,
    school.pincode,
  ]
    .filter(Boolean)
    .join(", ");
};

const FIELD_LABELS = {
  STUDENT_NAME: "Name",
  EMAIL: "Email",
  ADMISSION_NO: "Admission No",
  ROLL_NO: "Roll No",
  CLASS: "Class",
  SECTION: "Section",
  DOB: "DOB",
  BLOOD_GROUP: "Blood Group",
  GENDER: "Gender",
  FATHER_NAME: "Father Name",
  MOTHER_NAME: "Mother Name",
  MOBILE: "Mobile",
  ADDRESS: "Address",
  SESSION: "Session",
  QR_CODE: "QR Code",
  BARCODE: "Barcode",
  PRINCIPAL_SIGNATURE: "Principal Signature",
};

const getStudentValue = (student = {}, field) => {
  switch (field) {
    case "STUDENT_NAME":
      return getFullName(student) || "-";

    case "EMAIL":
      return student.email || "-";

    case "ADMISSION_NO":
      return student.admissionNo || "-";

    case "ROLL_NO":
      return student.rollNo || "-";

    case "CLASS":
      return (
        student.class?.className ||
        student.className ||
        "-"
      );

    case "SECTION":
      return (
        student.section?.sectionName ||
        student.sectionName ||
        "-"
      );

    case "DOB":
      return formatDate(student.dob);

    case "BLOOD_GROUP":
      return student.bloodGroup || "-";

    case "GENDER":
      return student.gender || "-";

    case "FATHER_NAME":
      return (
        student.parent?.fatherName ||
        student.fatherName ||
        "-"
      );

    case "MOTHER_NAME":
      return (
        student.parent?.motherName ||
        student.motherName ||
        "-"
      );

    case "MOBILE":
      return (
        student.mobile ||
        student.parent?.fatherMobile ||
        student.parent?.motherMobile ||
        "-"
      );

    case "ADDRESS":
      return (
        student.address ||
        [
          student.city,
          student.state,
          student.pincode,
        ]
          .filter(Boolean)
          .join(", ") ||
        "-"
      );

    case "SESSION":
      return (
        student.session?.sessionName ||
        student.sessionName ||
        "-"
      );

    default:
      return "-";
  }
};

const loadRemoteImage = async (imageUrl) => {
  if (!imageUrl) return null;

  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0",
      },
    });

    const originalBuffer = Buffer.from(response.data);

    if (!originalBuffer.length) {
      return null;
    }

    // JPG, PNG, WebP, AVIF आदि सभी को PDFKit-supported PNG बनाएं
    return await sharp(originalBuffer)
      .rotate()
      .flatten({
        background: "#FFFFFF",
      })
      .png()
      .toBuffer();
  } catch (error) {
    console.error(
      "Student image load failed:",
      imageUrl,
      error.message
    );

    return null;
  }
};

const createQrBuffer = async (student, school) => {
  const data = {
    studentId: student.id,
    admissionNo: student.admissionNo || null,
    studentName: getFullName(student),
    className: student.class?.className || null,
    sectionName:
      student.section?.sectionName || null,
    schoolId: school?.id || null,
  };

  return QRCode.toBuffer(JSON.stringify(data), {
    type: "png",
    width: 350,
    margin: 1,
    errorCorrectionLevel: "M",
  });
};

const createBarcodeBuffer = async (student) => {
  const value =
    student.admissionNo ||
    student.rollNo ||
    student.id;

  return bwipjs.toBuffer({
    bcid: "code128",
    text: String(value),
    scale: 3,
    height: 8,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
};

const drawCardBackground = ({
  doc,
  x,
  y,
  cardWidth,
  cardHeight,
  design,
  primaryColor,
  secondaryColor,
  backgroundImage,
}) => {
  doc.save();

  doc
    .roundedRect(
      x,
      y,
      cardWidth,
      cardHeight,
      mm(2)
    )
    .clip();

  if (backgroundImage) {
    try {
      doc.image(backgroundImage, x, y, {
        width: cardWidth,
        height: cardHeight,
      });
    } catch {
      doc
        .rect(x, y, cardWidth, cardHeight)
        .fill(secondaryColor);
    }
  } else {
    doc
      .rect(x, y, cardWidth, cardHeight)
      .fill(secondaryColor);
  }

  if (design === "MODERN") {
    const curveBottomY = y + mm(31);

    doc
      .moveTo(x, y)
      .lineTo(x + cardWidth, y)
      .lineTo(x + cardWidth, y + mm(8))
      .bezierCurveTo(
        x + cardWidth,
        y + mm(22),
        x + cardWidth * 0.62,
        curveBottomY,
        x,
        curveBottomY
      )
      .closePath()
      .fill(primaryColor);
  } else if (design === "MINIMAL") {
    doc
      .rect(x, y, mm(4), cardHeight)
      .fill(primaryColor);

    doc
      .rect(x, y, cardWidth, mm(3))
      .fill(primaryColor);
  } else {
    doc
      .rect(x, y, cardWidth, mm(19))
      .fill(primaryColor);
  }

  doc.restore();

  doc
    .save()
    .roundedRect(
      x,
      y,
      cardWidth,
      cardHeight,
      mm(2)
    )
    .lineWidth(0.8)
    .strokeColor(primaryColor)
    .stroke()
    .restore();
};

const drawStudentPhoto = ({
  doc,
  studentImage,
  photoX,
  photoY,
  photoWidth,
  photoHeight,
  isCircularPhoto,
  primaryColor,
}) => {
  doc.save();

  if (isCircularPhoto) {
    doc
      .circle(
        photoX + photoWidth / 2,
        photoY + photoHeight / 2,
        Math.min(photoWidth, photoHeight) / 2
      )
      .clip();
  } else {
    doc
      .roundedRect(
        photoX,
        photoY,
        photoWidth,
        photoHeight,
        mm(1)
      )
      .clip();
  }

  if (studentImage) {
    try {
      doc.image(studentImage, photoX, photoY, {
        fit: [photoWidth, photoHeight],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .rect(
          photoX,
          photoY,
          photoWidth,
          photoHeight
        )
        .fill("#E5E7EB");
    }
  } else {
    doc
      .rect(
        photoX,
        photoY,
        photoWidth,
        photoHeight
      )
      .fill("#E5E7EB");
  }

  doc.restore();

  doc
    .save()
    .lineWidth(0.8)
    .strokeColor(primaryColor);

  if (isCircularPhoto) {
    doc
      .circle(
        photoX + photoWidth / 2,
        photoY + photoHeight / 2,
        Math.min(photoWidth, photoHeight) / 2
      )
      .stroke();
  } else {
    doc
      .roundedRect(
        photoX,
        photoY,
        photoWidth,
        photoHeight,
        mm(1)
      )
      .stroke();
  }

  doc.restore();
};

const renderStudentIdCard = async ({
  doc,
  x,
  y,
  cardWidth,
  cardHeight,
  student,
  template,
  school,
  schoolLogo,
}) => {
  const fields = normalizeFields(
    template.defaultFields
  );

  const showField = (field) =>
    fields.includes(field);

  const design = String(
    template.design || "CLASSIC"
  )
    .trim()
    .toUpperCase();

  const primaryColor = normalizeHexColor(
    template.primaryColor,
    "#5721C9"
  );

  const secondaryColor = normalizeHexColor(
    template.secondaryColor,
    "#F8F5FF"
  );

  const textColor = normalizeHexColor(
    template.textColor,
    "#111827"
  );

  const frontConfig = parseJsonConfig(
    template.frontConfig
  );

  const photoShape = String(
    frontConfig.photoShape || "RECTANGLE"
  )
    .trim()
    .toUpperCase();

  const isCircularPhoto = [
    "CIRCLE",
    "CIRCULAR",
    "ROUND",
  ].includes(photoShape);

  const backgroundImage = await loadRemoteImage(
    template.frontBackground ||
      template.backgroundImage
  );

  drawCardBackground({
    doc,
    x,
    y,
    cardWidth,
    cardHeight,
    design,
    primaryColor,
    secondaryColor,
    backgroundImage,
  });

  const padding = mm(3);
  const footerHeight = mm(13);

  const headerHeight =
    design === "MODERN"
      ? mm(29)
      : design === "MINIMAL"
        ? mm(18)
        : mm(19);

  const schoolName =
    school?.schoolName ||
    school?.name ||
    "SCHOOL NAME";

  const schoolAddress =
    getSchoolAddress(school) ||
    "School Address";

  if (schoolLogo) {
    const logoSize =
      design === "MODERN" ? mm(9) : mm(10);

    const logoX =
      design === "MODERN"
        ? x + (cardWidth - logoSize) / 2
        : x + mm(3);

    const logoY =
      design === "MODERN"
        ? y + mm(2)
        : y + mm(3);

    doc.save();

    try {
      doc
        .circle(
          logoX + logoSize / 2,
          logoY + logoSize / 2,
          logoSize / 2
        )
        .clip();

      doc.image(schoolLogo, logoX, logoY, {
        fit: [logoSize, logoSize],
        align: "center",
        valign: "center",
      });
    } catch (error) {
      console.error(
        "School logo render error:",
        error.message
      );
    } finally {
      doc.restore();
    }
  }

  let schoolTextX;
  let schoolTextWidth;
  let schoolNameY;
  let headerTextColor;

  if (design === "MODERN") {
    schoolTextX = x + mm(3);
    schoolTextWidth = cardWidth - mm(6);
    schoolNameY = y + mm(12);
    headerTextColor = "#FFFFFF";
  } else if (design === "MINIMAL") {
    schoolTextX = x + mm(7);
    schoolTextWidth = cardWidth - mm(10);
    schoolNameY = y + mm(4);
    headerTextColor = textColor;
  } else {
    schoolTextX = x + mm(14);
    schoolTextWidth = cardWidth - mm(17);
    schoolNameY = y + mm(3);
    headerTextColor = "#FFFFFF";
  }

  doc
    .fillColor(headerTextColor)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(
      schoolName.toUpperCase(),
      schoolTextX,
      schoolNameY,
      {
        width: schoolTextWidth,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(4.2)
    .text(
      schoolAddress,
      schoolTextX,
      schoolNameY + mm(4),
      {
        width: schoolTextWidth,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(4.8)
    .text(
      "STUDENT ID CARD",
      schoolTextX,
      schoolNameY + mm(7),
      {
        width: schoolTextWidth,
        align: "center",
        lineBreak: false,
      }
    );

  const configuredPhotoWidth =
    Number(frontConfig.photoWidth) || 17;

  const configuredPhotoHeight =
    Number(frontConfig.photoHeight) || 20;

  const photoWidth = mm(configuredPhotoWidth);

  const photoHeight = isCircularPhoto
    ? photoWidth
    : mm(configuredPhotoHeight);

  const photoX =
    x + (cardWidth - photoWidth) / 2;

  const photoY =
    y +
    headerHeight +
    (design === "MODERN" ? mm(1) : mm(3));

  const studentImage = await loadRemoteImage(
    student.image
  );

  drawStudentPhoto({
    doc,
    studentImage,
    photoX,
    photoY,
    photoWidth,
    photoHeight,
    isCircularPhoto,
    primaryColor,
  });

  let currentY =
    photoY + photoHeight + mm(1.5);

  if (showField("STUDENT_NAME")) {
    doc
      .fillColor(textColor)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(
        getFullName(student).toUpperCase(),
        x + padding,
        currentY,
        {
          width: cardWidth - padding * 2,
          align: "center",
          lineBreak: false,
          ellipsis: true,
        }
      );

    currentY += mm(4);
  }

  const specialFields = [
    "STUDENT_NAME",
    "QR_CODE",
    "BARCODE",
    "PRINCIPAL_SIGNATURE",
  ];

  const detailFields = fields.filter(
    (field) => !specialFields.includes(field)
  );

  const footerY =
    y + cardHeight - footerHeight;

  const availableHeight = Math.max(
    mm(1),
    footerY - mm(1.5) - currentY
  );

  const rowHeight = Math.max(
    mm(2.2),
    Math.min(
      mm(3.4),
      availableHeight /
        Math.max(detailFields.length, 1)
    )
  );

  for (const field of detailFields) {
    if (currentY + rowHeight > footerY) break;

    const labelWidth =
      design === "MINIMAL"
        ? mm(16)
        : mm(15);

    doc
      .fillColor(textColor)
      .font("Helvetica-Bold")
      .fontSize(4.6)
      .text(
        `${FIELD_LABELS[field] || field}:`,
        x + padding,
        currentY,
        {
          width: labelWidth,
          lineBreak: false,
          ellipsis: true,
        }
      );

    doc
      .font("Helvetica")
      .fontSize(4.6)
      .text(
        String(
          getStudentValue(student, field) || "-"
        ),
        x + padding + labelWidth,
        currentY,
        {
          width:
            cardWidth -
            padding * 2 -
            labelWidth,
          lineBreak: false,
          ellipsis: true,
        }
      );

    currentY += rowHeight;
  }

  doc
    .save()
    .moveTo(x + mm(2), footerY)
    .lineTo(x + cardWidth - mm(2), footerY)
    .lineWidth(0.5)
    .strokeColor(primaryColor)
    .stroke()
    .restore();

  let leftFooterX = x + mm(2);

  if (showField("QR_CODE")) {
    try {
      const qrBuffer = await createQrBuffer(
        student,
        school
      );

      doc.image(
        qrBuffer,
        leftFooterX,
        footerY + mm(1.2),
        {
          width: mm(9.5),
          height: mm(9.5),
        }
      );

      leftFooterX += mm(11);
    } catch (error) {
      console.error(
        "QR render error:",
        error.message
      );
    }
  }

  if (showField("BARCODE")) {
    try {
      const barcodeBuffer =
        await createBarcodeBuffer(student);

      doc.image(
        barcodeBuffer,
        leftFooterX,
        footerY + mm(3),
        {
          fit: [mm(20), mm(6.5)],
          align: "center",
          valign: "center",
        }
      );
    } catch (error) {
      console.error(
        "Barcode render error:",
        error.message
      );
    }
  }

  if (showField("PRINCIPAL_SIGNATURE")) {
    const signatureUrl =
      frontConfig.principalSignature ||
      school?.principalSignature;

    const signatureBuffer =
      await loadRemoteImage(signatureUrl);

    const signatureWidth = mm(14);

    const signatureX =
      x +
      cardWidth -
      signatureWidth -
      mm(2);

    if (signatureBuffer) {
      try {
        doc.image(
          signatureBuffer,
          signatureX,
          footerY + mm(1),
          {
            fit: [signatureWidth, mm(6)],
            align: "center",
            valign: "center",
          }
        );
      } catch (error) {
        console.error(
          "Signature render error:",
          error.message
        );
      }
    }

    doc
      .fillColor(textColor)
      .font("Helvetica")
      .fontSize(4.3)
      .text(
        "Principal",
        signatureX,
        footerY + mm(8),
        {
          width: signatureWidth,
          align: "center",
          lineBreak: false,
        }
      );
  }
};

module.exports = {
  mm,
  normalizeHexColor,
  parseJsonConfig,
  normalizeFields,
  getFullName,
  getSchoolAddress,
  formatDate,
  getStudentValue,
  loadRemoteImage,
  createQrBuffer,
  createBarcodeBuffer,
  drawCardBackground,
  drawStudentPhoto,
  renderStudentIdCard,
};