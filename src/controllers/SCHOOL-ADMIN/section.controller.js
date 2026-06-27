const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const prisma = new PrismaClient();

exports.index = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const { search, classId } = req.query;

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
      //  sessionId: currentSession.id,
    };

    // Filter by Class
    if (classId) {
      where.classId = classId;
    }

    // Search
    if (search?.trim()) {
      where.OR = [
        {
          sectionName: {
            contains: search.trim(),
            mode: "insensitive",
          },
        },
        {
          class: {
            className: {
              contains: search.trim(),
              mode: "insensitive",
            },
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
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Sections fetched successfully.",
      data: sections,
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

exports.store = async (req, res) => {
  try {
    const { classId, sectionName, capacity,status } = req.body;

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

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId,sectionName,capacity } = req.body;

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

    // Section with Class
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

    // Validation
    if (section.class.sessionId !== currentSession.id) {
      return res.status(400).json({
        success: false,
        message: "You can only update sections of the current academic session.",
      });
    }

    // Update
    const updatedSection = await prisma.section.update({
      where: { id },
      data: {
        sectionName,
        classId,
        capacity
      },
    });

    return res.status(200).json({
      success: true,
      message: "Section updated successfully.",
      data: updatedSection,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.status = async(req,res)=>{
  try {
    const { id } = req.params;
    const { classId,sectionName,capacity } = req.body;

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
      where:{id},
      data:{
        status:!section.status
      }
    })

    return res.status(200).json({
      success:true,
      message:"Section status updated successfully.",
      data:updateStatus
    })
    
  } catch (error) {
    return res.status(500).json({
      success:false,
      message:error.message
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