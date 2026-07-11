const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const prisma = new PrismaClient();

exports.index = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search, classId, classTeacherId, coClassTeacherId } = req.query;

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

    // TC Issued Students
    const transferStudents = await prisma.transferCertificate.findMany({
      where: {
        schoolId: req.user.schoolId,
        sessionId: currentSession.id,
        status: "ISSUED",
      },
      select: {
        studentId: true,
      },
    });

    const issuedStudentIds = transferStudents.map((tc) => tc.studentId);

    const where = {
      schoolId: req.user.schoolId,
    };

    if (classId) where.classId = classId;
    if (classTeacherId) where.classTeacherId = classTeacherId;
    if (coClassTeacherId) where.coClassTeacherId = coClassTeacherId;

    if (search?.trim()) {
      const searchTerm = search.trim();

      where.OR = [
        {
          sectionName: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          class: {
            className: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
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
        session: {
          select: {
            sessionName: true,
          },
        },
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Student count excluding transferred students
    const formattedSections = await Promise.all(
      sections.map(async (section) => {
        const studentCount = await prisma.student.count({
          where: {
            schoolId: req.user.schoolId,
            sectionId: section.id,
            sessionId: currentSession.id,
            id: {
              notIn: issuedStudentIds,
            },
          },
        });

        return {
          ...section,
          _count: {
            students: studentCount,
          },
          classTeacher: section.classTeacher?.status
            ? section.classTeacher
            : null,
          coClassTeacher: section.coClassTeacher?.status
            ? section.coClassTeacher
            : null,
        };
      })
    );

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
      message: error.message,
    });
  }
};

exports.getAllSection = async (req, res) => {
  try {
    const { classId } = req.query;
    // Sections of Current Session
    const sections = await prisma.section.findMany({
      where: {
        schoolId: req.user.schoolId,
        classId: classId,
        status: true
      },
      orderBy: {
        sectionName: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Sections fetched successfully.",
      data: sections,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ STORE - Create new section
// exports.store = async (req, res) => {
//   try {
//     const { classId, sectionName, capacity, status, classTeacherId, coClassTeacherId } = req.body;

//     if (!classId || !sectionName) {
//       return res.status(400).json({
//         success: false,
//         message: "Class and Section Name are required",
//       });
//     }

//     const currentSession = await prisma.academicSession.findFirst({
//       where: {
//         schoolId: req.user.schoolId,
//         isCurrent: true,
//       },
//     });

//     if (!currentSession) {
//       return res.status(404).json({
//         success: false,
//         message: "Current academic session not found.",
//       });
//     }

//     // Check class belongs to school
//     const classData = await prisma.class.findFirst({
//       where: {
//         id: classId,
//         schoolId: req.user.schoolId,
//       },
//     });

//     if (!classData) {
//       return res.status(404).json({
//         success: false,
//         message: "Class not found",
//       });
//     }

//     // Check duplicate section
//     const existingSection = await prisma.section.findFirst({
//       where: {
//         classId,
//         sectionName: sectionName.trim().toUpperCase(),
//       },
//     });

//     if (existingSection) {
//       return res.status(409).json({
//         success: false,
//         message: "Section already exists for this class",
//       });
//     }

//     // Validate Class Teacher if provided
//     if (classTeacherId) {
//       const teacher = await prisma.teacher.findFirst({
//         where: {
//           id: classTeacherId,
//           schoolId: req.user.schoolId,
//         },
//       });

//       if (!teacher) {
//         return res.status(404).json({
//           success: false,
//           message: "Class Teacher not found",
//         });
//       }
//     }

//     // Validate Co-Class Teacher if provided
//     if (coClassTeacherId) {
//       const teacher = await prisma.teacher.findFirst({
//         where: {
//           id: coClassTeacherId,
//           schoolId: req.user.schoolId,
//         },
//       });

//       if (!teacher) {
//         return res.status(404).json({
//           success: false,
//           message: "Co-Class Teacher not found",
//         });
//       }
//     }

//     // Check if class teacher and co-class teacher are same
//     if (classTeacherId && coClassTeacherId && classTeacherId === coClassTeacherId) {
//       return res.status(400).json({
//         success: false,
//         message: "Class Teacher and Co-Class Teacher cannot be the same",
//       });
//     }

//     const section = await prisma.section.create({
//       data: {
//         schoolId: req.user.schoolId,
//         classId,
//         sectionName: sectionName.trim().toUpperCase(),
//         capacity: capacity ? Number(capacity) : null,
//         status: status !== undefined ? status : true,
//         classTeacherId: classTeacherId || null,
//         coClassTeacherId: coClassTeacherId || null,
//         sessionId: currentSession.id || null,
//       },
//       include: {
//         class: {
//           select: {
//             id: true,
//             className: true,
//           },
//         },
//         classTeacher: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//           },
//         },
//         coClassTeacher: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//           },
//         },
//       },
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Section created successfully",
//       data: section,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Internal Server Error",
//     });
//   }
// };

exports.store = async (req, res) => {
  try {
    const { classId, sectionName, capacity, status } = req.body;

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
        sessionId: currentSession.id,
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

    // const currentSession = await prisma.academicSession.findFirst({
    //   where: {
    //     schoolId: req.user.schoolId,
    //     isCurrent: true,
    //   },
    // });

    // if (!currentSession) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Current academic session not found.",
    //   });
    // }

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

    // if (section.class.sessionId !== currentSession.id) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "You can only delete sections of the current academic session.",
    //   });
    // }

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

exports.getStudentBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { page, limit, skip } = getPagination(req);

    // Get filter parameters from query
    const {
      search,
      gender,
      status,
      sortBy = 'firstName',
      sortOrder = 'asc',
      category,
      nationality,
      religion,
      bloodGroup,
      transportMode,
      hostel,
      minRollNo,
      maxRollNo,
      fromDate,
      toDate,
      classId
    } = req.query;

    // Validate sectionId
    if (!sectionId) {
      return res.status(400).json({
        success: false,
        message: "Section ID is required.",
      });
    }

    // Get current academic session
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

    // Build where clause for filters
    const whereClause = {
      schoolId: req.user.schoolId,
      sectionId: sectionId,
      sessionId: currentSession.id,
    };

    // Search filter
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
      ];
    }

    // Gender filter
    if (gender && gender !== 'ALL') {
      whereClause.gender = gender;
    }

    // Status filter
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    // Category filter
    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    // Nationality filter
    if (nationality && nationality !== 'ALL') {
      whereClause.nationality = nationality;
    }

    // Religion filter
    if (religion && religion !== 'ALL') {
      whereClause.religion = religion;
    }

    // Blood Group filter
    if (bloodGroup && bloodGroup !== 'ALL') {
      whereClause.bloodGroup = bloodGroup;
    }

    // Transport Mode filter
    if (transportMode && transportMode !== 'ALL') {
      whereClause.transportMode = transportMode;
    }

    // Hostel filter
    if (hostel && hostel !== 'ALL') {
      whereClause.hostel = hostel === 'true';
    }

    // Class filter
    if (classId) {
      whereClause.classId = classId;
    }

    // Roll Number range filter
    if (minRollNo || maxRollNo) {
      whereClause.rollNo = {};
      if (minRollNo) {
        whereClause.rollNo.gte = parseInt(minRollNo);
      }
      if (maxRollNo) {
        whereClause.rollNo.lte = parseInt(maxRollNo);
      }
    }

    // Admission Date range filter
    if (fromDate || toDate) {
      whereClause.admissionDate = {};
      if (fromDate) {
        whereClause.admissionDate.gte = new Date(fromDate);
      }
      if (toDate) {
        whereClause.admissionDate.lte = new Date(toDate);
      }
    }

    // Build order by clause
    const orderByClause = {};
    const validSortFields = ['firstName', 'lastName', 'admissionNo', 'rollNo', 'dob', 'admissionDate', 'gender', 'status', 'createdAt'];

    if (validSortFields.includes(sortBy)) {
      orderByClause[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderByClause.firstName = 'asc';
    }

    // Get total count for pagination with filters
    const totalStudents = await prisma.student.count({
      where: whereClause,
    });

    // Fetch students with pagination and filters
    const students = await prisma.student.findMany({
      where: whereClause,
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
      },
      skip: skip,
      take: limit,
      orderBy: orderByClause,
    });

    // If no students found
    if (!students || students.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No students found matching the criteria.",
        data: [],
        pagination: getPaginationMeta(1, limit, 0),

      });
    }

    return res.status(200).json({
      success: true,
      message: "Students fetched successfully.",
      data: students,
      pagination: getPaginationMeta(page, limit, totalStudents),

    });
  } catch (error) {
    console.error('Error in getStudentBySection:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch students.",
    });
  }
};