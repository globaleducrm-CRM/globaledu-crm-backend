const { PrismaClient } = require('@prisma/client');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const prisma = new PrismaClient();

exports.createTimetable = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const {
      name,
      classId,
      sectionId,
      sessionId,
      status = "DRAFT",
      config,
      periods,
      force = false
    } = req.body;

    // ===== VALIDATION =====
    if (!name || !classId || !sectionId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Name, Class, Section and Session are required."
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Timetable configuration is required."
      });
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one period is required."
      });
    }

    // ===== CHECK IF TIMETABLE EXISTS =====
    const existingTimetable = await prisma.timetable.findFirst({
      where: {
        schoolId,
        sessionId,
        classId,
        sectionId
      },
      include: {
        periods: true
      }
    });

    if (existingTimetable) {
      if (force) {
        await prisma.$transaction(async (prisma) => {
          await prisma.timetablePeriod.deleteMany({
            where: { timetableId: existingTimetable.id }
          });
          await prisma.timetable.delete({
            where: { id: existingTimetable.id }
          });

          const configExists = await prisma.timetableConfig.findFirst({
            where: { schoolId, sessionId, classId, sectionId }
          });

          if (configExists) {
            await prisma.periodMaster.deleteMany({
              where: { timetableConfigId: configExists.id }
            });
            await prisma.timetableConfig.delete({
              where: { id: configExists.id }
            });
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Timetable already exists for this Class & Section.",
          existing: {
            id: existingTimetable.id,
            name: existingTimetable.name,
            status: existingTimetable.status
          }
        });
      }
    }

    // ===== VALIDATE PERIODS =====
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const duplicate = new Set();

    for (const item of periods) {
      if (!validDays.includes(item.day)) {
        return res.status(400).json({
          success: false,
          message: `Invalid day: ${item.day}. Must be one of ${validDays.join(', ')}`
        });
      }

      const key = `${item.day}-${item.periodNo}`;
      if (duplicate.has(key)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate entry: ${item.day} Period ${item.periodNo}`
        });
      }
      duplicate.add(key);

      if (!item.periodNo || typeof item.periodNo !== 'number') {
        return res.status(400).json({
          success: false,
          message: `Period number is required for ${item.day}`
        });
      }

      if (!item.startTime || !item.endTime) {
        return res.status(400).json({
          success: false,
          message: `Start time and end time are required for ${item.day} Period ${item.periodNo}`
        });
      }

      // ✅ REMOVED: subjectId and teacherId validation
      // Now subjectId and teacherId are optional (can be null)

      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(item.startTime) || !timeRegex.test(item.endTime)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time format for ${item.day} Period ${item.periodNo}. Use HH:MM format.`
        });
      }
    }

    // ===== TEACHER CONFLICT CHECK (Only if teacherId is provided) =====
    const teacherPeriods = [];
    for (const item of periods) {
      // ✅ Only check if teacherId exists
      if (!item.teacherId || item.isBreak) continue;
      
      teacherPeriods.push({
        teacherId: item.teacherId,
        day: item.day,
        periodNo: item.periodNo
      });
    }

    for (const tp of teacherPeriods) {
      const teacherBusy = await prisma.timetablePeriod.findFirst({
        where: {
          teacherId: tp.teacherId,
          day: tp.day,
          timetable: {
            schoolId,
            sessionId
          },
          periodMaster: {
            periodNo: tp.periodNo
          }
        },
        include: {
          timetable: {
            select: {
              id: true,
              name: true,
              class: {
                select: {
                  sortName: true
                }
              },
              section: {
                select: {
                  sectionName: true
                }
              }
            }
          }
        }
      });

      if (teacherBusy) {
        const className = teacherBusy.timetable.class?.sortName || 'Class';
        const sectionName = teacherBusy.timetable.section?.sectionName || 'Section';
        
        return res.status(400).json({
          success: false,
          message: `Teacher is already assigned in "${teacherBusy.timetable.name}" (${className}-${sectionName}) on ${tp.day} Period ${tp.periodNo}`
        });
      }
    }

    // ===== CREATE TIMETABLE WITH TRANSACTION =====
    const result = await prisma.$transaction(async (prisma) => {
      
      const timetableConfig = await prisma.timetableConfig.create({
        data: {
          schoolId,
          sessionId,
          classId,
          sectionId,
          startTime: config.startTime,
          endTime: config.endTime,
          slotDuration: config.slotDuration || 45,
          breakDuration: config.breakDuration || 5,
          lunchDuration: config.lunchDuration || 30,
          lunchStart: config.lunchStart || null,
          enableLunchBreak: config.enableLunchBreak || false,
          breakAfterSlots: config.breakAfterSlots || 2,
          totalSlotsPerDay: config.totalSlotsPerDay || 8,
          schoolDays: config.schoolDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
          isActive: true
        }
      });

      // Create PeriodMasters
      const periodMasterMap = new Map();
      const uniquePeriods = new Map();

      for (const item of periods) {
        const key = `${item.periodNo}`;
        if (!uniquePeriods.has(key)) {
          uniquePeriods.set(key, {
            periodNo: item.periodNo,
            name: item.isBreak ? (item.name || 'Break') : `Period ${item.periodNo}`,
            startTime: item.startTime,
            endTime: item.endTime,
            isBreak: item.isBreak || false
          });
        }
      }

      for (const [key, periodData] of uniquePeriods) {
        const periodMaster = await prisma.periodMaster.create({
          data: {
            timetableConfigId: timetableConfig.id,
            periodNo: periodData.periodNo,
            name: periodData.name,
            startTime: periodData.startTime,
            endTime: periodData.endTime,
            isBreak: periodData.isBreak,
            status: true
          }
        });

        periodMasterMap.set(periodData.periodNo, periodMaster.id);
      }

      // Create Timetable
      const timetable = await prisma.timetable.create({
        data: {
          name,
          schoolId,
          sessionId,
          classId,
          sectionId,
          status,
          periods: {
            create: periods.map(item => ({
              day: item.day,
              periodMasterId: periodMasterMap.get(item.periodNo),
              subjectId: item.isBreak ? null : (item.subjectId || null), // ✅ Allow null
              teacherId: item.isBreak ? null : (item.teacherId || null), // ✅ Allow null
              roomNo: item.isBreak ? null : (item.roomNo || null)
            }))
          }
        },
        include: {
          session: true,
          class: true,
          section: true,
          school: true,
          periods: {
            include: {
              periodMaster: true,
              subject: true,
              teacher: true
            },
            orderBy: [
              { day: "asc" },
              { periodMaster: { periodNo: "asc" } }
            ]
          }
        }
      });

      return { timetable, timetableConfig };
    });

    return res.status(201).json({
      success: true,
      message: "Timetable created successfully.",
      data: result.timetable,
      config: result.timetableConfig
    });

  } catch (error) {
    console.error('Error creating timetable:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "A timetable with this configuration already exists. Please check existing timetables or use 'force: true' to replace."
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while creating the timetable."
    });
  }
};





exports.index = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const {
    
      search = "",
      sessionId,
      classId,
      sectionId,
      status
    } = req.query;

    const { page, limit, skip } = getPagination(req)

    // ✅ Build where clause
    const where = {
      schoolId: schoolId // ✅ Fix: remove extra comma
    };

    // ✅ Filters
    if (sessionId) where.sessionId = sessionId;
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (status) where.status = status;

    // ✅ Search with OR conditions
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          class: {
            sortName: {
              contains: search,
              mode: "insensitive"
            }
          }
        },
        {
          section: {
            sectionName: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      ];
    }

    // ✅ Fetch timetables with relations
    const [timetables, total] = await Promise.all([
      prisma.timetable.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: {
          createdAt: "desc"
        },
        include: {
          session: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true
            }
          },
          class: {
            select: {
              id: true,
              sortName: true
            }
          },
          section: {
            select: {
              id: true,
              sectionName: true
            }
          },
          _count: {
            select: {
              periods: true // ✅ Total periods count
            }
          },
          // ✅ Include periods with periodMaster to get break info
          periods: {
            select: {
              id: true,
              day: true,
              periodMaster: {
                select: {
                  id: true,
                  periodNo: true,
                  isBreak: true,
                  name: true
                }
              },
              subject: {
                select: {
                  id: true,
                  subjectName: true
                }
              },
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            },
            orderBy: [
              { day: "asc" },
              { periodMaster: { periodNo: "asc" } }
            ]
          }
        },
        
      }),

      prisma.timetable.count({
        where
      })
    ]);

    // ✅ Format response with additional stats
    const formattedData = timetables.map(timetable => {
      // Count actual periods (excluding breaks)
      const actualPeriods = timetable.periods.filter(
        p => p.periodMaster && !p.periodMaster.isBreak
      ).length;

      // Count breaks
      const breaks = timetable.periods.filter(
        p => p.periodMaster && p.periodMaster.isBreak
      ).length;

      // Group periods by day for quick view
      const periodsByDay = {};
      timetable.periods.forEach(p => {
        if (!periodsByDay[p.day]) {
          periodsByDay[p.day] = [];
        }
        periodsByDay[p.day].push({
          periodNo: p.periodMaster?.periodNo || 0,
          name: p.periodMaster?.name || '',
          isBreak: p.periodMaster?.isBreak || false,
          subject: p.subject?.subjectName || null,
          teacher: p.teacher ? `${p.teacher.firstName} ${p.teacher.lastName}` : null
        });
      });

      return {
        id: timetable.id,
        name: timetable.name,
        status: timetable.status,
        session: timetable.session,
        class: timetable.class,
        section: timetable.section,
        totalPeriods: timetable._count?.periods || 0,
        actualPeriods: actualPeriods,
        breaks: breaks,
        periodsByDay: periodsByDay,
        createdAt: timetable.createdAt,
        updatedAt: timetable.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      message: "Timetables fetched successfully.",
      data: formattedData,
      pagination: getPaginationMeta(page, limit, total)
    });

  } catch (error) {
    console.error("Index Timetable Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};


exports.show = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const timetable = await prisma.timetable.findFirst({
      where: {
        id,
        schoolId
      },
      include: {
        session: {
          select: {
            id: true,
            sessionName: true,
            isCurrent: true
          }
        },
        class: {
          select: {
            id: true,
            className: true,
            sortName: true
          }
        },
        section: {
          select: {
            id: true,
            sectionName: true
          }
        },
        periods: {
          include: {
            periodMaster: {
              select: {
                id: true,
                periodNo: true,
                name: true,
                startTime: true,
                endTime: true,
                isBreak: true
              }
            },
            subject: {
              select: {
                id: true,
                subjectName: true,
                shortName: true
              }
            },
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true
              }
            }
          },
          orderBy: [
            {
              day: "asc"
            },
            {
              periodMaster: {
                periodNo: "asc" // ✅ Correct way
              }
            }
          ]
        }
      }
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found."
      });
    }

    // ✅ Format periods for better response
    const formattedPeriods = timetable.periods.map(period => ({
      id: period.id,
      day: period.day,
      roomNo: period.roomNo,
      periodMaster: period.periodMaster,
      subject: period.subject,
      teacher: period.teacher,
      isBreak: period.periodMaster?.isBreak || false,
      periodNo: period.periodMaster?.periodNo || 0,
      startTime: period.periodMaster?.startTime || null,
      endTime: period.periodMaster?.endTime || null
    }));

    // ✅ Group periods by day
    const periodsByDay = {};
    formattedPeriods.forEach(period => {
      if (!periodsByDay[period.day]) {
        periodsByDay[period.day] = [];
      }
      periodsByDay[period.day].push(period);
    });

    // ✅ Get timetable config
    const timetableConfig = await prisma.timetableConfig.findFirst({
      where: {
        schoolId: schoolId,
        sessionId: timetable.sessionId,
        classId: timetable.classId,
        sectionId: timetable.sectionId
      },
      include: {
        periods: {
          orderBy: {
            periodNo: "asc"
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Timetable fetched successfully.",
      data: {
        id: timetable.id,
        name: timetable.name,
        status: timetable.status,
        session: timetable.session,
        class: timetable.class,
        section: timetable.section,
        createdAt: timetable.createdAt,
        updatedAt: timetable.updatedAt,
        config: timetableConfig ? {
          id: timetableConfig.id,
          startTime: timetableConfig.startTime,
          endTime: timetableConfig.endTime,
          slotDuration: timetableConfig.slotDuration,
          breakDuration: timetableConfig.breakDuration,
          lunchDuration: timetableConfig.lunchDuration,
          lunchStart: timetableConfig.lunchStart,
          enableLunchBreak: timetableConfig.enableLunchBreak,
          breakAfterSlots: timetableConfig.breakAfterSlots,
          totalSlotsPerDay: timetableConfig.totalSlotsPerDay,
          schoolDays: timetableConfig.schoolDays,
          isActive: timetableConfig.isActive
        } : null,
        periods: formattedPeriods,
        periodsByDay: periodsByDay,
        stats: {
          totalPeriods: formattedPeriods.length,
          teachingPeriods: formattedPeriods.filter(p => !p.isBreak).length,
          breaks: formattedPeriods.filter(p => p.isBreak).length,
          days: Object.keys(periodsByDay).length
        }
      }
    });

  } catch (error) {
    console.error("Show Timetable Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};


exports.updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const {
      name,
      classId,
      sectionId,
      sessionId,
      status = "DRAFT",
      config,
      periods
    } = req.body;

    // ===== VALIDATION =====
    if (!name || !classId || !sectionId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Name, Class, Section and Session are required."
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Timetable configuration is required."
      });
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one period is required."
      });
    }

    // ===== CHECK TIMETABLE EXISTS =====
    const existingTimetable = await prisma.timetable.findFirst({
      where: {
        id,
        schoolId
      },
      include: {
        periods: true
      }
    });

    if (!existingTimetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found."
      });
    }

    // ===== VALIDATE PERIODS =====
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const duplicate = new Set();

    for (const item of periods) {
      if (!validDays.includes(item.day)) {
        return res.status(400).json({
          success: false,
          message: `Invalid day: ${item.day}. Must be one of ${validDays.join(', ')}`
        });
      }

      const key = `${item.day}-${item.periodNo}`;
      if (duplicate.has(key)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate entry: ${item.day} Period ${item.periodNo}`
        });
      }
      duplicate.add(key);

      if (!item.periodNo || typeof item.periodNo !== 'number') {
        return res.status(400).json({
          success: false,
          message: `Period number is required for ${item.day}`
        });
      }

      if (!item.startTime || !item.endTime) {
        return res.status(400).json({
          success: false,
          message: `Start time and end time are required for ${item.day} Period ${item.periodNo}`
        });
      }

      if (!item.isBreak) {
        if (!item.subjectId) {
          return res.status(400).json({
            success: false,
            message: `Subject is required for ${item.day} Period ${item.periodNo}`
          });
        }
        if (!item.teacherId) {
          return res.status(400).json({
            success: false,
            message: `Teacher is required for ${item.day} Period ${item.periodNo}`
          });
        }
      }

      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(item.startTime) || !timeRegex.test(item.endTime)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time format for ${item.day} Period ${item.periodNo}. Use HH:MM format.`
        });
      }
    }

    // ===== TEACHER CONFLICT CHECK =====
    const teacherPeriods = [];
    for (const item of periods) {
      if (!item.teacherId || item.isBreak) continue;
      
      teacherPeriods.push({
        teacherId: item.teacherId,
        day: item.day,
        periodNo: item.periodNo
      });
    }

    for (const tp of teacherPeriods) {
      const teacherBusy = await prisma.timetablePeriod.findFirst({
        where: {
          teacherId: tp.teacherId,
          day: tp.day,
          timetable: {
            schoolId,
            sessionId,
            id: {
              not: id
            }
          },
          periodMaster: {
            periodNo: tp.periodNo
          }
        },
        include: {
          timetable: {
            select: {
              id: true,
              name: true,
              class: {
                select: {
                  sortName: true
                }
              },
              section: {
                select: {
                  sectionName: true
                }
              }
            }
          }
        }
      });

      if (teacherBusy) {
        return res.status(400).json({
          success: false,
          message: `Teacher is already assigned in "${teacherBusy.timetable.name}" (${teacherBusy.timetable.class?.sortName}-${teacherBusy.timetable.section?.sectionName}) on ${tp.day} Period ${tp.periodNo}`
        });
      }
    }

    // ===== UPDATE TIMETABLE WITH TRANSACTION =====
    const result = await prisma.$transaction(async (tx) => {
      
      // 1️⃣ GET OR CREATE TIMETABLE CONFIG
      let timetableConfig = await tx.timetableConfig.findFirst({
        where: {
          schoolId,
          sessionId,
          classId,
          sectionId
        }
      });

      if (!timetableConfig) {
        timetableConfig = await tx.timetableConfig.create({
          data: {
            schoolId,
            sessionId,
            classId,
            sectionId,
            startTime: config.startTime,
            endTime: config.endTime,
            slotDuration: config.slotDuration || 45,
            breakDuration: config.breakDuration || 5,
            lunchDuration: config.lunchDuration || 30,
            lunchStart: config.lunchStart || null,
            enableLunchBreak: config.enableLunchBreak || false,
            breakAfterSlots: config.breakAfterSlots || 2,
            totalSlotsPerDay: config.totalSlotsPerDay || 8,
            schoolDays: config.schoolDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
            isActive: true
          }
        });
      } else {
        await tx.timetableConfig.update({
          where: { id: timetableConfig.id },
          data: {
            startTime: config.startTime,
            endTime: config.endTime,
            slotDuration: config.slotDuration || 45,
            breakDuration: config.breakDuration || 5,
            lunchDuration: config.lunchDuration || 30,
            lunchStart: config.lunchStart || null,
            enableLunchBreak: config.enableLunchBreak || false,
            breakAfterSlots: config.breakAfterSlots || 2,
            totalSlotsPerDay: config.totalSlotsPerDay || 8,
            schoolDays: config.schoolDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
            isActive: true
          }
        });
      }

      // 2️⃣ DELETE OLD TIMETABLE PERIODS FIRST (Important!)
      await tx.timetablePeriod.deleteMany({
        where: {
          timetableId: id
        }
      });

      // 3️⃣ DELETE OLD PERIOD MASTERS (Now safe to delete)
      await tx.periodMaster.deleteMany({
        where: {
          timetableConfigId: timetableConfig.id
        }
      });

      // 4️⃣ CREATE UNIQUE PERIOD MASTERS
      const periodMasterMap = new Map();
      const uniquePeriods = new Map();

      for (const item of periods) {
        const key = `${item.periodNo}`;
        if (!uniquePeriods.has(key)) {
          uniquePeriods.set(key, {
            periodNo: item.periodNo,
            name: item.isBreak ? (item.name || (item.isLunch ? 'Lunch Break' : 'Break')) : `Period ${item.periodNo}`,
            startTime: item.startTime,
            endTime: item.endTime,
            isBreak: item.isBreak || false
          });
        }
      }

      for (const [key, periodData] of uniquePeriods) {
        const periodMaster = await tx.periodMaster.create({
          data: {
            timetableConfigId: timetableConfig.id,
            periodNo: periodData.periodNo,
            name: periodData.name,
            startTime: periodData.startTime,
            endTime: periodData.endTime,
            isBreak: periodData.isBreak,
            status: true
          }
        });

        periodMasterMap.set(periodData.periodNo, periodMaster.id);
      }

      // 5️⃣ UPDATE TIMETABLE
      await tx.timetable.update({
        where: { id },
        data: {
          name,
          classId,
          sectionId,
          sessionId,
          status
        }
      });

      // 6️⃣ CREATE NEW TIMETABLE PERIODS
      await tx.timetablePeriod.createMany({
        data: periods.map(item => ({
          timetableId: id,
          day: item.day,
          periodMasterId: periodMasterMap.get(item.periodNo),
          subjectId: item.isBreak ? null : (item.subjectId || null),
          teacherId: item.isBreak ? null : (item.teacherId || null),
          roomNo: item.isBreak ? null : (item.roomNo || null)
        }))
      });

      // 7️⃣ FETCH UPDATED TIMETABLE
      const updatedTimetable = await tx.timetable.findUnique({
        where: { id },
        include: {
          session: {
            select: {
              id: true,
              sessionName: true,
              isCurrent: true
            }
          },
          class: {
            select: {
              id: true,
              className: true,
              sortName: true
            }
          },
          section: {
            select: {
              id: true,
              sectionName: true
            }
          },
          periods: {
            include: {
              periodMaster: {
                select: {
                  id: true,
                  periodNo: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                  isBreak: true
                }
              },
              subject: {
                select: {
                  id: true,
                  subjectName: true,
                  shortName: true
                }
              },
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeId: true
                }
              }
            },
            orderBy: [
              { day: "asc" },
              { periodMaster: { periodNo: "asc" } }
            ]
          }
        }
      });

      return { updatedTimetable, timetableConfig };
    });

    // ===== SUCCESS RESPONSE =====
    return res.status(200).json({
      success: true,
      message: "Timetable updated successfully.",
      data: result.updatedTimetable,
      config: result.timetableConfig
    });

  } catch (error) {
    console.error("Update Timetable Error:", error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "A timetable with this configuration already exists."
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });
  }
};



exports.toggleBreakStatus = async (req, res) => {
  try {
    const { timetableId, periodId,periodMasterId } = req.params;

    const period = await prisma.timetablePeriod.findFirst({
      where: {
        id: periodId,
        timetableId,
        periodMasterId
      },
      include: {
        periodMaster: true,
      },
    });

    if (!period) {
      return res.status(404).json({
        success: false,
        message: "Timetable period not found.",
      });
    }

    const updatedPeriodMaster = await prisma.periodMaster.update({
      where: {
        id: period.periodMasterId,
      },
      data: {
        isBreak: !period.periodMaster.isBreak,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Period marked as ${
        updatedPeriodMaster.isBreak ? "Break" : "Teaching Period"
      }.`,
      data: updatedPeriodMaster,
    });
  } catch (error) {
    console.error("Toggle Break Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update break status.",
      error: error.message,
    });
  }
};

exports.status = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const timetable = await prisma.timetable.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json({
      success: true,
      message: "Timetable published successfully.",
      data: timetable,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};