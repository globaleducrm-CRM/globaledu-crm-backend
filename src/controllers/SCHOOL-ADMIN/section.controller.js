const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const prisma = new PrismaClient();

exports.index = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search, classId, classTeacherId, coClassTeacherId } = req.query;



    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: req.user.schoolId,
        isCurrent: true,
      },
    });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current academic session not found.",
      });
    }

    const where = {
      schoolId: req.user.schoolId,
      sessionId: currentSession.id, // Uncomment when ready
    };

    // Filter by Class
    if (classId) {
      where.classId = classId;
    }

    // Filter by Class Teacher
    if (classTeacherId) {
      where.classTeacherId = classTeacherId;
    }

    // Filter by Co-Class Teacher
    if (coClassTeacherId) {
      where.coClassTeacherId = coClassTeacherId;
    }

    // Search functionality
    if (search?.trim()) {
      const searchTerm = search.trim();

      where.OR = [
        // Search by section name
        {
          sectionName: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        // Search by class name
        {
          class: {
            className: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        // Search by class teacher's full name
        {
          classTeacher: {
            OR: [
              {
                firstName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
        // Search by co-class teacher's full name
        {
          coClassTeacher: {
            OR: [
              {
                firstName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      ];
    }

    const totalSections = await prisma.section.count({ where });

    const sections = await prisma.section.findMany({
      where,
      skip,
      take: limit,
      include: {
        class: {
          select: {
            id: true,
            className: true,
            status: true,
          },
        },
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
        coClassTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });



    const formattedSections = sections.map((section) => ({
      ...section,
      classTeacher:
        section.classTeacher?.status
          ? section.classTeacher
          : null,

      coClassTeacher:
        section.coClassTeacher?.status
          ? section.coClassTeacher
          : null,
    }));

    return res.status(200).json({
      success: true,
      message: "Sections fetched successfully.",
      data: formattedSections,
      pagination: getPaginationMeta(page, limit, totalSections),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ✅ STORE - Create new section
exports.store = async (req, res) => {
  try {
    const { classId, sectionName, capacity, status, classTeacherId, coClassTeacherId } = req.body;

    if (!classId || !sectionName) {
      return res.status(400).json({
        success: false,
        message: "Class and Section Name are required",
      });
    }

    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: req.user.schoolId,
        isCurrent: true,
      },
    });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current academic session not found.",
      });
    }

    // Check class belongs to school
    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: req.user.schoolId,
      },
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Check duplicate section
    const existingSection = await prisma.section.findFirst({
      where: {
        classId,
        sectionName: sectionName.trim().toUpperCase(),
      },
    });

    if (existingSection) {
      return res.status(409).json({
        success: false,
        message: "Section already exists for this class",
      });
    }

    // Validate Class Teacher if provided
    if (classTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: classTeacherId,
          schoolId: req.user.schoolId,
        },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Class Teacher not found",
        });
      }
    }

    // Validate Co-Class Teacher if provided
    if (coClassTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: coClassTeacherId,
          schoolId: req.user.schoolId,
        },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Co-Class Teacher not found",
        });
      }
    }

    // Check if class teacher and co-class teacher are same
    if (classTeacherId && coClassTeacherId && classTeacherId === coClassTeacherId) {
      return res.status(400).json({
        success: false,
        message: "Class Teacher and Co-Class Teacher cannot be the same",
      });
    }

    const section = await prisma.section.create({
      data: {
        schoolId: req.user.schoolId,
        classId,
        sectionName: sectionName.trim().toUpperCase(),
        capacity: capacity ? Number(capacity) : null,
        status: status !== undefined ? status : true,
        classTeacherId: classTeacherId || null,
        coClassTeacherId: coClassTeacherId || null,
        sessionId: currentSession.id || null,
      },
      include: {
        class: {
          select: {
            id: true,
            className: true,
          },
        },
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        coClassTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: section,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.store = async (req, res) => {
  try {
    const { classId, sectionName, capacity, status } = req.body;

    if (!classId || !sectionName) {
      return res.status(400).json({
        success: false,
        message: "Class and Section Name are required",
      });
    }

    // Check class belongs to school
    const classData = await prisma.class.findFirst({
      where: {
        id: classId,
        schoolId: req.user.schoolId,
      },
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Check duplicate section
    const existingSection = await prisma.section.findFirst({
      where: {
        classId,
        sectionName: sectionName.trim(),
      },
    });

    if (existingSection) {
      return res.status(409).json({
        success: false,
        message: "Section already exists for this class",
      });
    }



    const section = await prisma.section.create({
      data: {
        schoolId: req.user.schoolId,
        classId,
        sectionName: sectionName.trim(),
        capacity: capacity ? Number(capacity) : null,
        status: status || true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: section,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.show = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await prisma.section.findFirst({
      where: {
        id,
        schoolId: req.user.schoolId
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Section fetched successfully.",
      data: section
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ Update Section

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sectionName,
      capacity,
      classId,
      classTeacherId,
      coClassTeacherId,
      compulsorySubjects,
      optionalSubjects,
      status,
      sessionId
    } = req.body;

    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: req.user.schoolId,
        isCurrent: true,
      },
    });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current academic session not found.",
      });
    }

    // ✅ Check if section exists
    const existingSection = await prisma.section.findFirst({
      where: {
        id: id,
        schoolId: req.user.schoolId
      }
    });

    if (!existingSection) {
      return res.status(404).json({
        success: false,
        message: "Section not found"
      });
    }

    // ✅ If class is being changed, validate new class
    if (classId && classId !== existingSection.classId) {
      const classExists = await prisma.class.findFirst({
        where: {
          id: classId,
          schoolId: req.user.schoolId
        }
      });

      if (!classExists) {
        return res.status(404).json({
          success: false,
          message: "Class not found"
        });
      }

      // ✅ Check if section already exists in new class
      const duplicateSection = await prisma.section.findFirst({
        where: {
          classId: classId,
          sectionName: sectionName?.trim().toUpperCase() || existingSection.sectionName,
          schoolId: req.user.schoolId,
          id: { not: id }
        }
      });

      if (duplicateSection) {
        return res.status(409).json({
          success: false,
          message: `Section ${sectionName} already exists in this class`
        });
      }
    }

    // ✅ Validate Class Teacher (if provided)
    if (classTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: classTeacherId,
          schoolId: req.user.schoolId
        }
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Class Teacher not found"
        });
      }
    }

    // ✅ Validate Co-Class Teacher (if provided)
    if (coClassTeacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: coClassTeacherId,
          schoolId: req.user.schoolId
        }
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: "Co-Class Teacher not found"
        });
      }
    }

    // ✅ Check if class teacher and co-class teacher are same
    if (classTeacherId && coClassTeacherId && classTeacherId === coClassTeacherId) {
      return res.status(400).json({
        success: false,
        message: "Class Teacher and Co-Class Teacher cannot be the same"
      });
    }

    // ✅ Update Section
    const updatedSection = await prisma.section.update({
      where: { id: id },
      data: {
        sectionName: sectionName?.trim().toUpperCase() || existingSection.sectionName,
        capacity: capacity ? parseInt(capacity) : null,
        classId: classId || existingSection.classId,
        classTeacherId: classTeacherId !== undefined ? classTeacherId : existingSection.classTeacherId,
        coClassTeacherId: coClassTeacherId !== undefined ? coClassTeacherId : existingSection.coClassTeacherId,
        status: status === 'ACTIVE' ? true : (status === 'INACTIVE' ? false : existingSection.status),
        sessionId: sessionId || currentSession.id
      },
      include: {
        class: {
          select: {
            id: true,
            className: true
          }
        },
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        coClassTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    // ✅ If compulsorySubjects provided, update (if you have a separate table for subjects)
    // Note: If you don't have SectionSubject table, you need to handle subjects differently
    // For now, we'll just update the section without subjects
    if (compulsorySubjects && compulsorySubjects.length > 0) {
      // You can update subjects in a separate table if you have one
      console.log('Compulsory Subjects:', compulsorySubjects);
      // TODO: Add your subject update logic here
    }

    if (optionalSubjects && optionalSubjects.length > 0) {
      console.log('Optional Subjects:', optionalSubjects);
      // TODO: Add your subject update logic here
    }

    // ✅ Fetch updated section
    const completeSection = await prisma.section.findUnique({
      where: { id: id },
      include: {
        class: {
          select: {
            id: true,
            className: true
          }
        },
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            mobile: true
          }
        },
        coClassTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            mobile: true
          }
        },
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data: completeSection
    });

  } catch (error) {
    console.error("❌ Update Section Error:", error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: "Section already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};

exports.status = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, sectionName, capacity } = req.body;

    // Current Session
    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: req.user.schoolId,
        isCurrent: true,
      },
    });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current academic session not found.",
      });
    }

    const section = await prisma.section.findFirst({
      where: {
        id,
        schoolId: req.user.schoolId,
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found.",
      });
    }

    if (section.class.sessionId !== currentSession.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update sections of the current academic session.",
      });
    }

    const updateStatus = await prisma.section.update({
      where: { id },
      data: {
        status: !section.status
      }
    })

    return res.status(200).json({
      success: true,
      message: "Section status updated successfully.",
      data: updateStatus
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}


exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: req.user.schoolId,
        isCurrent: true,
      },
    });

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: "Current academic session not found.",
      });
    }

    const section = await prisma.section.findFirst({
      where: {
        id,
        schoolId: req.user.schoolId,
      },
      include: {
        class: true,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found.",
      });
    }

    if (section.class.sessionId !== currentSession.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete sections of the current academic session.",
      });
    }

    await prisma.section.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Section deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};