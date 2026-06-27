const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.index = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const where = {
      schoolId: req.user.schoolId,
    };

    if (search) {
      where.OR = [
        {
          sectionName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          class: {
            className: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const totalSections = await prisma.section.count({
      where,
    });

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

    const totalPages = Math.ceil(totalSections / limit);

    return res.status(200).json({
      success: true,
      message: "Sections fetched successfully.",
      data: sections,

      pagination: {
        currentPage: page,
        perPage: limit,
        totalRecords: totalSections,
        totalPages,

        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,

        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      },
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