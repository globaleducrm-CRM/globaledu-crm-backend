const { PrismaClient, Prisma } = require("@prisma/client");
const PDFDocument = require("pdfkit");

const {
  mm,
  getFullName,
  loadRemoteImage,
  renderStudentIdCard,
  renderBackSide,
} = require("../../helpers/studentIdCardPdf.helper");

const prisma = new PrismaClient();



exports.createStudentIdCardTemplate = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const {
      sessionId,
      templateName,
      orientation = "PORTRAIT",
      cardSide = "FRONT_ONLY",
      width = 54,
      height = 86,
      primaryColor = "#7C3AED",
      secondaryColor = "#F3E8FF",
      textColor = "#111827",
      backgroundImage,
      frontBackground,
      backBackground,
      showLogo = true,
      showStudentPhoto = true,
      showQrCode = true,
      showBarcode = false,
      showAdmissionNo = true,
      showRollNo = true,
      showClass = true,
      showSection = true,
      showDob = true,
      showBloodGroup = true,
      showFatherName = true,
      showMotherName = false,
      showMobile = true,
      showAddress = true,
      showSession = true,
      principalName,
      principalSignature,
      authorizedLabel = "Principal Signature",
      footerText,
      terms,
      frontConfig,
      backConfig,
      isDefault = false,
    } = req.body;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        message: "Template name is required.",
      });
    }

    if (sessionId) {
      const session = await prisma.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
        },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Academic session not found.",
        });
      }
    }

    const duplicate = await prisma.studentIdCardTemplate.findFirst({
      where: {
        schoolId,
        templateName: {
          equals: templateName.trim(),
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Template name already exists.",
      });
    }

    const template = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.studentIdCardTemplate.updateMany({
          where: { schoolId },
          data: { isDefault: false },
        });
      }

      return tx.studentIdCardTemplate.create({
        data: {
          schoolId,
          sessionId: sessionId || null,
          templateName: templateName.trim(),
          orientation,
          cardSide,
          width: Number(width),
          height: Number(height),
          primaryColor,
          secondaryColor,
          textColor,
          backgroundImage: backgroundImage || null,
          frontBackground: frontBackground || null,
          backBackground: backBackground || null,
          showLogo,
          showStudentPhoto,
          showQrCode,
          showBarcode,
          showAdmissionNo,
          showRollNo,
          showClass,
          showSection,
          showDob,
          showBloodGroup,
          showFatherName,
          showMotherName,
          showMobile,
          showAddress,
          showSession,
          principalName: principalName || null,
          principalSignature: principalSignature || null,
          authorizedLabel,
          footerText: footerText || null,
          terms: terms || null,
          frontConfig: frontConfig || undefined,
          backConfig: backConfig || undefined,
          isDefault,
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Student ID card template created successfully.",
      data: template,
    });
  } catch (error) {
    console.error("Create ID card template error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};


exports.createDefaultIdCardTemplates = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { sessionId } = req.body;

    if (sessionId) {
      const session = await prisma.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
        },
        select: { id: true },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Academic session not found.",
        });
      }
    }

    const templates = [
      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Purple Curve",
        design: "PURPLE_CURVE",
        orientation: "PORTRAIT",
        cardSide: "FRONT_ONLY",
        width: 54,
        height: 86,
        primaryColor: "#5721C9",
        secondaryColor: "#F8F5FF",
        textColor: "#111827",
        defaultFields: [
          "STUDENT_NAME",
          "CLASS",
          "SECTION",
          "ROLL_NO",
          "ADMISSION_NO",
          "BLOOD_GROUP",
          "SESSION",
          "QR_CODE",
          "PRINCIPAL_SIGNATURE",
        ],
        frontConfig: {
          headerStyle: "CURVED",
          photoShape: "CIRCLE",
          logoPosition: "TOP_LEFT",
          photoPosition: "CENTER",
          namePosition: "CENTER",
          detailsLayout: "TABLE",
          footerStyle: "SIGNATURE_AND_QR",
        },
        isSystem: true,
        isDefault: true,
      },

      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Orange Smart School",
        design: "ORANGE_WAVE",
        orientation: "PORTRAIT",
        cardSide: "FRONT_ONLY",
        width: 54,
        height: 86,
        primaryColor: "#F97316",
        secondaryColor: "#FFF7ED",
        textColor: "#111827",
        defaultFields: [
          "STUDENT_NAME",
          "CLASS",
          "ADMISSION_NO",
          "FATHER_NAME",
          "ADDRESS",
          "MOBILE",
          "GENDER",
          "SESSION",
          "PRINCIPAL_SIGNATURE",
        ],
        frontConfig: {
          headerStyle: "ORANGE_WAVE",
          photoShape: "RECTANGLE",
          logoPosition: "TOP_LEFT",
          photoPosition: "TOP_CENTER",
          detailsLayout: "LEFT_LABELS",
          footerStyle: "COLORED_WAVE",
        },
        isSystem: true,
        isDefault: false,
      },

      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Blue Modern",
        design: "BLUE_MODERN",
        orientation: "PORTRAIT",
        cardSide: "FRONT_ONLY",
        width: 54,
        height: 86,
        primaryColor: "#2563EB",
        secondaryColor: "#EFF6FF",
        textColor: "#0F172A",
        defaultFields: [
          "STUDENT_NAME",
          "ADMISSION_NO",
          "ROLL_NO",
          "CLASS",
          "SECTION",
          "DOB",
          "BLOOD_GROUP",
          "SESSION",
          "QR_CODE",
        ],
        frontConfig: {
          headerStyle: "DIAGONAL",
          photoShape: "ROUNDED",
          logoPosition: "TOP_CENTER",
          photoPosition: "CENTER",
          detailsLayout: "TWO_COLUMN",
          footerStyle: "QR_ONLY",
        },
        isSystem: true,
        isDefault: false,
      },

      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Green Classic",
        design: "GREEN_CLASSIC",
        orientation: "PORTRAIT",
        cardSide: "FRONT_BACK",
        width: 54,
        height: 86,
        primaryColor: "#15803D",
        secondaryColor: "#F0FDF4",
        textColor: "#14532D",
        defaultFields: [
          "STUDENT_NAME",
          "ADMISSION_NO",
          "CLASS",
          "SECTION",
          "DOB",
          "FATHER_NAME",
          "MOBILE",
          "ADDRESS",
          "SESSION",
          "PRINCIPAL_SIGNATURE",
        ],
        frontConfig: {
          headerStyle: "CLASSIC",
          photoShape: "RECTANGLE",
          logoPosition: "TOP_CENTER",
          detailsLayout: "TABLE",
        },
        backConfig: {
          fields: ["MOBILE", "ADDRESS"],
          showTerms: true,
          showEmergencyContact: true,
        },
        isSystem: true,
        isDefault: false,
      },

      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Red Minimal",
        design: "RED_MINIMAL",
        orientation: "PORTRAIT",
        cardSide: "FRONT_ONLY",
        width: 54,
        height: 86,
        primaryColor: "#DC2626",
        secondaryColor: "#FEF2F2",
        textColor: "#1F2937",
        defaultFields: [
          "STUDENT_NAME",
          "ADMISSION_NO",
          "CLASS",
          "SECTION",
          "SESSION",
          "BARCODE",
        ],
        frontConfig: {
          headerStyle: "MINIMAL",
          photoShape: "CIRCLE",
          logoPosition: "TOP_CENTER",
          detailsLayout: "COMPACT",
          footerStyle: "BARCODE",
        },
        isSystem: true,
        isDefault: false,
      },

      {
        schoolId,
        sessionId: sessionId || null,
        templateName: "Dark Premium",
        design: "DARK_PREMIUM",
        orientation: "PORTRAIT",
        cardSide: "FRONT_BACK",
        width: 54,
        height: 86,
        primaryColor: "#111827",
        secondaryColor: "#D4AF37",
        textColor: "#FFFFFF",
        defaultFields: [
          "STUDENT_NAME",
          "ADMISSION_NO",
          "ROLL_NO",
          "CLASS",
          "SECTION",
          "BLOOD_GROUP",
          "GENDER",
          "SESSION",
          "QR_CODE",
          "PRINCIPAL_SIGNATURE",
        ],
        frontConfig: {
          headerStyle: "PREMIUM",
          photoShape: "ROUNDED",
          logoPosition: "TOP_LEFT",
          detailsLayout: "TWO_COLUMN",
          borderStyle: "GOLD",
        },
        backConfig: {
          fields: ["FATHER_NAME", "MOBILE", "ADDRESS"],
          showTerms: true,
          showEmergencyContact: true,
        },
        isSystem: true,
        isDefault: false,
      },
    ];

    const createdTemplates = await prisma.$transaction(
      templates.map((template) =>
        prisma.studentIdCardTemplate.upsert({
          where: {
            schoolId_templateName: {
              schoolId,
              templateName: template.templateName,
            },
          },
          update: {
            sessionId: template.sessionId,
            design: template.design,
            orientation: template.orientation,
            cardSide: template.cardSide,
            primaryColor: template.primaryColor,
            secondaryColor: template.secondaryColor,
            textColor: template.textColor,
            defaultFields: template.defaultFields,
            frontConfig: template.frontConfig,
            backConfig: template.backConfig,
            isSystem: true,
            isActive: true,
          },
          create: template,
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: "6 student ID card templates created successfully.",
      data: createdTemplates,
    });
  } catch (error) {
    console.error("Create default templates error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};


exports.getStudentIdCardTemplates = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const {
      sessionId,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(Number(page), 1);
    const perPage = Math.max(Number(limit), 1);
    const skip = (currentPage - 1) * perPage;

    const where = { schoolId };

    if (sessionId) {
      where.OR = [
        { sessionId },
        { sessionId: null },
      ];
    }

    if (status === "ACTIVE") where.isActive = true;
    if (status === "INACTIVE") where.isActive = false;

    if (search) {
      where.templateName = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    const [templates, totalRecords] = await prisma.$transaction([
      prisma.studentIdCardTemplate.findMany({
        where,
        include: {
          session: {
            select: {
              id: true,
              sessionName: true,
            },
          },
          _count: {
            select: {
              idCards: true,
            },
          },
        },
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: perPage,
      }),

      prisma.studentIdCardTemplate.count({ where }),
    ]);

    const totalPages = Math.ceil(totalRecords / perPage);

    return res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        currentPage,
        perPage,
        totalRecords,
        totalPages,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
      },
    });
  } catch (error) {
    console.error("Get ID card templates error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};


exports.getStudentsForIdCard = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const {
      sessionId,
      classId,
      sectionId,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    if (!sessionId || !classId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "Session, class and section are required.",
      });
    }

    const currentPage = Math.max(Number(page), 1);
    const perPage = Math.max(Number(limit), 1);
    const skip = (currentPage - 1) * perPage;

    const where = {
      schoolId,
      sessionId,
      classId,
      sectionId,
      status: "ACTIVE",
    };

    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
        {
          admissionNo: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
        {
          rollNo: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
      ];
    }

    const [students, totalRecords] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          admissionNo: true,
          rollNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          image: true,
          dob: true,
          gender: true,
          bloodGroup: true,
          mobile: true,
          address: true,
          city: true,
          state: true,
          pincode: true,

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

          parent: {
            select: {
              fatherName: true,
              motherName: true,
              fatherMobile: true,
              motherMobile: true,
            },
          },

          idCards: {
            where: { sessionId },
            select: {
              id: true,
              cardNumber: true,
              status: true,
              issueDate: true,
              expiryDate: true,
            },
          },
        },
        orderBy: [
          { rollNo: "asc" },
          { firstName: "asc" },
        ],
        skip,
        take: perPage,
      }),

      prisma.student.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        currentPage,
        perPage,
        totalRecords,
        totalPages: Math.ceil(totalRecords / perPage),
      },
    });
  } catch (error) {
    console.error("Get ID card students error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};


exports.generateStudentIdCards = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const generatedById = req.user.id;

    const {
      sessionId,
      classId,
      sectionId,
      templateId,
      studentIds,
      issueDate,
      expiryDate,
    } = req.body;

    if (
      !sessionId ||
      !classId ||
      !sectionId ||
      !templateId ||
      !Array.isArray(studentIds) ||
      studentIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Session, class, section, template and studentIds are required.",
      });
    }

    const [template, school, session, students] = await Promise.all([
      prisma.studentIdCardTemplate.findFirst({
        where: {
          id: templateId,
          schoolId,
          isActive: true,
        },
      }),

      prisma.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          schoolName: true,
          schoolCode: true,
          logo: true,
          addressLine: true,
          city: true,
          state: true,
          pincode: true,
          phone: true,
          email: true,
        },
      }),

      prisma.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
        },
      }),

      prisma.student.findMany({
        where: {
          id: { in: studentIds },
          schoolId,
          sessionId,
          classId,
          sectionId,
          status: "ACTIVE",
        },
        include: {
          class: true,
          section: true,
          parent: true,
        },
      }),
    ]);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Active ID card template not found.",
      });
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Academic session not found.",
      });
    }

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected students do not belong to the selected class and section.",
      });
    }

    const cards = await prisma.$transaction(
      students.map((student) => {
        const shortSchoolCode = school.schoolCode || "GEC";

        const cardNumber =
          `${shortSchoolCode}-${session.sessionName}-` +
          `${student.admissionNo}`;

        return prisma.studentIdCard.upsert({
          where: {
            schoolId_sessionId_studentId: {
              schoolId,
              sessionId,
              studentId: student.id,
            },
          },
          update: {
            templateId,
            cardNumber,
            qrCodeValue: JSON.stringify({
              studentId: student.id,
              admissionNo: student.admissionNo,
              schoolId,
              sessionId,
            }),
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            status: "ACTIVE",
            generatedById,
            generatedAt: new Date(),
          },
          create: {
            schoolId,
            sessionId,
            studentId: student.id,
            templateId,
            cardNumber,
            qrCodeValue: JSON.stringify({
              studentId: student.id,
              admissionNo: student.admissionNo,
              schoolId,
              sessionId,
            }),
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            status: "ACTIVE",
            generatedById,
          },
        });
      })
    );

    return res.status(201).json({
      success: true,
      message: `${cards.length} student ID cards generated successfully.`,
      data: {
        school,
        session,
        template,
        students,
        cards,
      },
    });
  } catch (error) {
    console.error("Generate student ID cards error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

exports.status = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const template = await prisma.studentIdCardTemplate.findFirst({
      where: {
        id,
        schoolId,
      },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "ID card template not found.",
      });
    }

    const updatedTemplate = await prisma.$transaction(async (tx) => {
      if (isActive) {
        // Same school/session ke sabhi templates inactive
        await tx.studentIdCardTemplate.updateMany({
          where: {
            schoolId,
            sessionId: template.sessionId,
            id: {
              not: template.id,
            },
          },
          data: {
            isActive: false,
          },
        });
      }

      return tx.studentIdCardTemplate.update({
        where: {
          id: template.id,
        },
        data: {
          isActive,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: isActive
        ? "Template activated successfully."
        : "Template deactivated successfully.",
      data: updatedTemplate,
    });
  } catch (error) {
    console.error("Template status error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

exports.saveUpdateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const {
      templateName,
      design,
      orientation,
      cardSide,
      width,
      height,
      primaryColor,
      secondaryColor,
      textColor,
      backgroundImage,
      frontBackground,
      backBackground,
      defaultFields,
      frontConfig,
      backConfig,
    } = req.body;

    const existingTemplate =
      await prisma.studentIdCardTemplate.findFirst({
        where: {
          id,
          schoolId,
        },
      });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "ID card template not found.",
      });
    }

    // [] allowed है, इसलिए Student Name optional रहेगा
    if (
      defaultFields !== undefined &&
      !Array.isArray(defaultFields)
    ) {
      return res.status(400).json({
        success: false,
        message: "defaultFields must be an array.",
      });
    }

    const normalizedFields =
      defaultFields === undefined
        ? undefined
        : [
            ...new Set(
              defaultFields
                .filter(Boolean)
                .map((field) =>
                  String(field).trim().toUpperCase()
                )
                .map((field) =>
                  ["FIRSTNAME", "FIRST_NAME"].includes(field)
                    ? "STUDENT_NAME"
                    : field
                )
            ),
          ];

    if (normalizedFields) {
      const invalidFields = normalizedFields.filter(
        (field) =>
          !ALLOWED_ID_CARD_FIELDS.includes(field)
      );

      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid ID card fields: ${invalidFields.join(
            ", "
          )}`,
        });
      }
    }

    if (
      design !== undefined &&
      !ALLOWED_ID_CARD_DESIGNS.includes(design)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID card design: ${design}`,
      });
    }

    if (
      orientation !== undefined &&
      !ALLOWED_ORIENTATIONS.includes(orientation)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid orientation: ${orientation}`,
      });
    }

    if (
      cardSide !== undefined &&
      !ALLOWED_CARD_SIDES.includes(cardSide)
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid card side: ${cardSide}`,
      });
    }

    const updateData = {};

    if (templateName !== undefined) {
      const normalizedName = String(templateName).trim();

      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          message: "Template name cannot be empty.",
        });
      }

      updateData.templateName = normalizedName;
    }

    if (design !== undefined) {
      updateData.design = design;
    }

    if (orientation !== undefined) {
      updateData.orientation = orientation;
    }

    if (cardSide !== undefined) {
      updateData.cardSide = cardSide;
    }

    if (width !== undefined) {
      const parsedWidth = Number(width);

      if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
        return res.status(400).json({
          success: false,
          message: "Width must be a positive number.",
        });
      }

      updateData.width = parsedWidth;
    }

    if (height !== undefined) {
      const parsedHeight = Number(height);

      if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
        return res.status(400).json({
          success: false,
          message: "Height must be a positive number.",
        });
      }

      updateData.height = parsedHeight;
    }

    if (primaryColor !== undefined) {
      updateData.primaryColor = primaryColor || null;
    }

    if (secondaryColor !== undefined) {
      updateData.secondaryColor = secondaryColor || null;
    }

    if (textColor !== undefined) {
      updateData.textColor = textColor || null;
    }

    if (backgroundImage !== undefined) {
      updateData.backgroundImage = backgroundImage || null;
    }

    if (frontBackground !== undefined) {
      updateData.frontBackground = frontBackground || null;
    }

    if (backBackground !== undefined) {
      updateData.backBackground = backBackground || null;
    }

    if (normalizedFields !== undefined) {
      updateData.defaultFields = normalizedFields;
    }

    if (frontConfig !== undefined) {
      updateData.frontConfig = frontConfig;
    }

    if (backConfig !== undefined) {
      updateData.backConfig = backConfig;
    }

    const updatedTemplate =
      await prisma.studentIdCardTemplate.update({
        where: {
          id: existingTemplate.id,
        },
        data: updateData,
        include: {
          school: {
            select: {
              id: true,
              name: true,
              logo: true,
              addressLine: true,
              city: true,
              state: true,
              pincode: true,
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

    return res.status(200).json({
      success: true,
      message: "ID card template updated successfully.",
      data: updatedTemplate,
    });
  } catch (error) {
    console.error("Update ID card template error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "ID card template not found.",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Template name already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "ID card template update nahi hua.",
    });
  }
};


exports.generateStudentIdCardsPdf = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;

    const {
      studentIds = [],
      sessionId,
      templateId,
    } = req.body;

    /* =========================================================
       VALIDATION
    ========================================================= */

    if (!schoolId) {
      return res.status(403).json({
        success: false,
        message: "School access is required.",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session is required.",
      });
    }

    if (
      !Array.isArray(studentIds) ||
      studentIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one student select karein.",
      });
    }

    const uniqueStudentIds = [
      ...new Set(
        studentIds
          .filter(Boolean)
          .map((id) => String(id).trim())
          .filter(Boolean)
      ),
    ];

    if (!uniqueStudentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Valid student IDs are required.",
      });
    }

    /* =========================================================
       GET ACTIVE TEMPLATE
    ========================================================= */

    const schoolSelect = {
      id: true,
      name: true,
      logo: true,
      addressLine: true,
      district: true,
      city: true,
      state: true,
      pincode: true,
      principalName: true,
      // principalSignature: true,
    };

    let activeTemplate = null;

    /*
     * यदि frontend ने template select किया है,
     * तो exact selected template use होगा।
     */
    if (templateId) {
      activeTemplate =
        await prisma.studentIdCardTemplate.findFirst({
          where: {
            id: String(templateId),
            schoolId,
            isActive: true,
            OR: [
              {
                sessionId,
              },
              {
                sessionId: null,
              },
            ],
          },
          include: {
            school: {
              select: schoolSelect,
            },
          },
        });
    }

    /*
     * Selected template ID नहीं आने पर:
     * session का default active template मिलेगा।
     */
    if (!activeTemplate && !templateId) {
      activeTemplate =
        await prisma.studentIdCardTemplate.findFirst({
          where: {
            schoolId,
            sessionId,
            isActive: true,
            isDefault: true,
          },
          include: {
            school: {
              select: schoolSelect,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        });
    }

    /*
     * Session default नहीं मिला तो session का
     * latest active template मिलेगा।
     */
    if (!activeTemplate && !templateId) {
      activeTemplate =
        await prisma.studentIdCardTemplate.findFirst({
          where: {
            schoolId,
            sessionId,
            isActive: true,
          },
          include: {
            school: {
              select: schoolSelect,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        });
    }

    /*
     * अंत में school का general default template।
     */
    if (!activeTemplate && !templateId) {
      activeTemplate =
        await prisma.studentIdCardTemplate.findFirst({
          where: {
            schoolId,
            sessionId: null,
            isActive: true,
            isDefault: true,
          },
          include: {
            school: {
              select: schoolSelect,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        });
    }

    if (!activeTemplate) {
      return res.status(404).json({
        success: false,
        message: templateId
          ? "Selected active ID card template nahi mila."
          : "Active ID card template nahi mila. Pehle kisi template ko active/default karein.",
      });
    }

    /* =========================================================
       GET SELECTED STUDENTS
    ========================================================= */

    const students = await prisma.student.findMany({
      where: {
        id: {
          in: uniqueStudentIds,
        },
        schoolId,
        sessionId,
        status: "ACTIVE",
      },
      include: {
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

        parent: {
          select: {
            fatherName: true,
            fatherMobile: true,
            motherName: true,
            motherMobile: true,
          },
        },
      },
    });

    if (!students.length) {
      return res.status(404).json({
        success: false,
        message:
          "Selected session mein active students nahi mile.",
      });
    }

    /*
     * Frontend checkbox selection का order maintain करें।
     */
    const studentMap = new Map(
      students.map((student) => [
        String(student.id),
        student,
      ])
    );

    const orderedStudents = uniqueStudentIds
      .map((id) => studentMap.get(id))
      .filter(Boolean);

    const missingStudentIds = uniqueStudentIds.filter(
      (id) => !studentMap.has(id)
    );

    if (missingStudentIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Kuch selected students active nahi hain ya selected session mein nahi mile.",
        missingStudentIds,
      });
    }

    /* =========================================================
       CHECK STUDENT IMAGES
    ========================================================= */

    const studentsWithoutImage =
      orderedStudents.filter(
        (student) => !student.image
      );

    if (studentsWithoutImage.length) {
      return res.status(400).json({
        success: false,
        message:
          "Kuch selected students ki image available nahi hai.",
        students: studentsWithoutImage.map(
          (student) => ({
            id: student.id,
            admissionNo:
              student.admissionNo || null,
            name: getFullName(student),
          })
        ),
      });
    }

    /* =========================================================
       CARD DIMENSIONS
    ========================================================= */

    const orientation = String(
      activeTemplate.orientation || "PORTRAIT"
    )
      .trim()
      .toUpperCase();

    let cardWidthMm =
      Number(activeTemplate.width) || 54;

    let cardHeightMm =
      Number(activeTemplate.height) || 86;

    /*
     * Database में width/height उलटी save होने पर
     * orientation के अनुसार normalize करें।
     */
    if (
      orientation === "LANDSCAPE" &&
      cardWidthMm < cardHeightMm
    ) {
      [cardWidthMm, cardHeightMm] = [
        cardHeightMm,
        cardWidthMm,
      ];
    }

    if (
      orientation === "PORTRAIT" &&
      cardWidthMm > cardHeightMm
    ) {
      [cardWidthMm, cardHeightMm] = [
        cardHeightMm,
        cardWidthMm,
      ];
    }

    const cardWidth = mm(cardWidthMm);
    const cardHeight = mm(cardHeightMm);

    /* =========================================================
       PDF PAGE CONFIGURATION
    ========================================================= */

    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
      compress: true,

      info: {
        Title: `${activeTemplate.templateName || "Student"} ID Cards`,
        Author:
          activeTemplate.school?.schoolName ||
          "GlobalEdu CRM",
        Subject: "Student ID Cards",
      },
    });

    const pdfChunks = [];

    doc.on("data", (chunk) => {
      pdfChunks.push(chunk);
    });

    const pdfFinished = new Promise(
      (resolve, reject) => {
        doc.once("end", resolve);
        doc.once("error", reject);
      }
    );

    const pageWidth = mm(210);
    const pageHeight = mm(297);

    const pagePaddingX = mm(9);
    const pagePaddingY = mm(9);

    const horizontalGap = mm(5);
    const verticalGap = mm(5);

    const availablePageWidth =
      pageWidth - pagePaddingX * 2;

    const availablePageHeight =
      pageHeight - pagePaddingY * 2;

    const columns = Math.max(
      1,
      Math.floor(
        (availablePageWidth + horizontalGap) /
          (cardWidth + horizontalGap)
      )
    );

    const rows = Math.max(
      1,
      Math.floor(
        (availablePageHeight + verticalGap) /
          (cardHeight + verticalGap)
      )
    );

    const cardsPerPage = columns * rows;

    if (
      cardWidth > availablePageWidth ||
      cardHeight > availablePageHeight
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Template card size A4 page ke printable area se bada hai.",
      });
    }

    const school = activeTemplate.school;

    const schoolLogo = await loadRemoteImage(
      school?.logo
    );

    /* =========================================================
       REUSABLE PAGE POSITION
    ========================================================= */

    const getCardPosition = (index) => {
      const pagePosition =
        index % cardsPerPage;

      const column =
        pagePosition % columns;

      const row = Math.floor(
        pagePosition / columns
      );

      return {
        pagePosition,

        x:
          pagePaddingX +
          column *
            (cardWidth + horizontalGap),

        y:
          pagePaddingY +
          row *
            (cardHeight + verticalGap),
      };
    };

    /* =========================================================
       FRONT SIDE
    ========================================================= */

    for (
      let index = 0;
      index < orderedStudents.length;
      index += 1
    ) {
      const { pagePosition, x, y } =
        getCardPosition(index);

      if (pagePosition === 0) {
        doc.addPage({
          size: "A4",
          layout: "portrait",
          margin: 0,
        });
      }

      await renderStudentIdCard({
        doc,
        x,
        y,
        cardWidth,
        cardHeight,
        student: orderedStudents[index],
        template: activeTemplate,
        school,
        schoolLogo,
      });
    }

    /* =========================================================
       OPTIONAL BACK SIDE
    ========================================================= */

    const cardSide = String(
      activeTemplate.cardSide || "FRONT_ONLY"
    )
      .trim()
      .toUpperCase();

    const shouldRenderBack = [
      "BOTH",
      "FRONT_AND_BACK",
      "FRONT_BACK",
    ].includes(cardSide);

    if (shouldRenderBack) {
      for (
        let index = 0;
        index < orderedStudents.length;
        index += 1
      ) {
        const { pagePosition, x, y } =
          getCardPosition(index);

        if (pagePosition === 0) {
          doc.addPage({
            size: "A4",
            layout: "portrait",
            margin: 0,
          });
        }

        await renderBackSide({
          doc,
          x,
          y,
          cardWidth,
          cardHeight,
          student: orderedStudents[index],
          template: activeTemplate,
          school,
        });
      }
    }

    /* =========================================================
       COMPLETE PDF
    ========================================================= */

    doc.end();

    await pdfFinished;

    const pdfBuffer = Buffer.concat(pdfChunks);

    if (!pdfBuffer.length) {
      throw new Error(
        "Generated PDF buffer is empty."
      );
    }

    const safeSessionName = String(
      orderedStudents[0]?.session
        ?.sessionName || "session"
    )
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 50);

    const safeTemplateName = String(
      activeTemplate.templateName ||
        "ID_Cards"
    )
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 50);

    const fileName =
      `${safeTemplateName}_${safeSessionName}_${Date.now()}.pdf`;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.setHeader(
      "Content-Length",
      String(pdfBuffer.length)
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error(
      "Generate student ID cards PDF error:",
      error
    );

    if (res.headersSent) {
      return res.end();
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Student ID card PDF generate nahi hui.",
    });
  }
};

exports.getTempleteStatusTrue = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(403).json({
        success: false,
        message: "School access is required.",
      });
    }

    // Current session की ID प्राप्त करें
    const currentSession =
      await prisma.academicSession.findFirst({
        where: {
          schoolId,
          isCurrent: true,
        },
        select: {
          id: true,
        },
      });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current session not found.",
      });
    }

    // Current session का latest active template
    const template =
      await prisma.studentIdCardTemplate.findFirst({
        where: {
          schoolId,
          sessionId: currentSession.id,
          isActive: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

    if (!template) {
      return res.status(404).json({
        success: false,
        message:
          "Current session ka active template not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Get active template error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Internal server error.",
    });
  }
};