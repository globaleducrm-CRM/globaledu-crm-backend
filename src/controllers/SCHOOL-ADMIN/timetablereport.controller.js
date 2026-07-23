// controllers/timetablereport.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.index = async (req, res) => {
    try {
        const {
            viewType,      // 'class' or 'teacher'
            classIds,      // comma separated IDs
            sectionIds,    // comma separated IDs
            teacherIds,    // comma separated IDs
            day,
        } = req.query;

        const schoolId = req.user.schoolId;

        // Validate required parameters
        if (!viewType) {
            return res.status(400).json({
                success: false,
                message: 'viewType is required (class or teacher)'
            });
        }

        // Get active session
        const activeSession = await prisma.academicSession.findFirst({
            where: {
                schoolId,
                isCurrent: true
            },
            select: {
                id: true,
                sessionName: true,
                startDate: true,
                endDate: true,
                isCurrent: true
            }
        });

        if (!activeSession) {
            return res.status(404).json({
                success: false,
                message: 'No active session found for this school'
            });
        }

        const currentSessionId = activeSession.id;

        // Parse comma separated IDs
        const classIdArray = classIds ? classIds.split(',').filter(id => id) : [];
        const sectionIdArray = sectionIds ? sectionIds.split(',').filter(id => id) : [];
        const teacherIdArray = teacherIds ? teacherIds.split(',').filter(id => id) : [];

        if (viewType === 'class' && (classIdArray.length === 0 || sectionIdArray.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'classIds and sectionIds are required for class view'
            });
        }

        if (viewType === 'teacher' && teacherIdArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'teacherIds are required for teacher view'
            });
        }

        let result = {
            viewType,
            schoolId,
            sessionId: currentSessionId,
            sessionName: activeSession.sessionName,
            selectedDay: day || null,
            data: null,
            summary: null
        };

        // Fetch data based on view type
        if (viewType === 'class') {
            // Get all timetables for the selected classes and sections
            const timetables = await prisma.timetable.findMany({
                where: {
                    schoolId,
                    sessionId: currentSessionId,
                    classId: {
                        in: classIdArray
                    },
                    sectionId: {
                        in: sectionIdArray
                    },
                    status: 'PUBLISHED'
                },
                include: {
                    class: {
                        select: {
                            id: true,

                            sortName: true
                        }
                    },
                    section: {
                        select: {
                            id: true,
                            sectionName: true,
                            classTeacher: {
                                select: {
                                    id: true,
                                    employeeId: true,
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        }
                    },
                    session: {
                        select: {
                            id: true,
                            sessionName: true,

                        }
                    },
                    periods: {
                        include: {
                            timetable: {
                                include: {
                                    class: true,
                                    section: true
                                }
                            },
                            subject: true,
                            teacher: {
                                include: {
                                    user: true
                                }
                            },
                            periodMaster: true
                        }
                    }
                }
            });



            // Get timetable config for the first class (assuming same config)
            const config = await prisma.timetableConfig.findUnique({
                where: {
                    schoolId_sessionId_classId_sectionId: {
                        schoolId,
                        sessionId: currentSessionId,
                        classId: classIdArray[0],
                        sectionId: sectionIdArray[0]
                    }
                },
                include: {
                    periods: {
                        orderBy: {
                            periodNo: 'asc'
                        }
                    }
                }
            });

            if (timetables.length === 0) {
                result.data = {
                    timetables: [],
                    classes: [],
                    sections: [],
                    session: null,
                    config: config
                        ? {
                            id: config.id,
                            startTime: config.startTime,
                            endTime: config.endTime,
                            periods: config.periods
                        }
                        : null,
                    periods: [],
                    periodsByDay: {},
                    totalPeriods: 0,
                    periodCount: 0
                };

                result.summary = {
                    totalPeriods: 0,
                    totalClasses: classIdArray.length,
                    totalSections: sectionIdArray.length,
                    subjects: {},
                    teachers: {},
                    classes: {}
                };

                return res.status(200).json(result);
            }

            // Combine all periods from all timetables
            let allPeriods = [];
            timetables.forEach(timetable => {
                allPeriods = [...allPeriods, ...timetable.periods];
            });

            // Filter periods by day if provided
            let periods = allPeriods;
            let selectedDay = day;
            if (day) {
                const dayUpper = day.toUpperCase();
                periods = periods.filter(p => p.day === dayUpper);
                selectedDay = dayUpper;
            }

            // Group periods by day
            const weekDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
            const periodsByDay = {};
            weekDays.forEach(dayName => {
                periodsByDay[dayName] = allPeriods
                    .filter(p => p.day === dayName)
                    .map(p => ({
                        periodNo: p.periodMaster.periodNo,
                        periodName: p.periodMaster.name,
                        startTime: p.periodMaster.startTime,
                        endTime: p.periodMaster.endTime,
                        subject: p.subject?.subjectName || p.subject?.name || null,
                        subjectId: p.subject?.id || null,
                        teacher: p.teacher?.user?.name || null,
                        teacherId: p.teacher?.id || null,
                        roomNo: p.roomNo || null,
                        class: p.timetable.class?.name || p.timetable.class?.sortName || null,
                        section: p.timetable.section?.name || p.timetable.section?.sectionName || null
                    }));
            });

            // Format periods for response
            const formattedPeriods = periods.map(p => ({
                id: p.id,
                day: p.day,
                periodNo: p.periodMaster.periodNo,
                periodName: p.periodMaster.name,
                startTime: p.periodMaster.startTime,
                endTime: p.periodMaster.endTime,
                subject: p.subject ? {
                    id: p.subject.id,
                    subjectName: p.subject.subjectName || p.subject.name,
                    subjectCode: p.subject.subjectCode || p.subject.code
                } : null,
                teacher: p.teacher ? {
                    id: p.teacher.id,
                    name: p.teacher.user.name,
                    email: p.teacher.user.email
                } : null,
                roomNo: p.roomNo,
                class: p.timetable.class ? {
                    id: p.timetable.class.id,
                    sortName: p.timetable.class.name || p.timetable.class.sortName
                } : null,
                section: p.timetable.section ? {
                    id: p.timetable.section.id,
                    sectionName: p.timetable.section.name || p.timetable.section.sectionName
                } : null
            }));

            // Generate summary
            const summary = {
                totalPeriods: allPeriods.length,
                totalClasses: new Set(timetables.map(t => t.classId)).size,
                totalSections: new Set(timetables.map(t => t.sectionId)).size,
                daysWithPeriods: {},
                subjects: {},
                teachers: {},
                classes: {}
            };

            weekDays.forEach(dayName => {
                const dayPeriods = allPeriods.filter(p => p.day === dayName);
                summary.daysWithPeriods[dayName] = {
                    count: dayPeriods.length,
                    subjects: [...new Set(dayPeriods.map(p => p.subject?.subjectName || p.subject?.name).filter(Boolean))]
                };
            });

            allPeriods.forEach(p => {
                if (p.subject) {
                    const subjectName = p.subject.subjectName || p.subject.name;
                    summary.subjects[subjectName] = (summary.subjects[subjectName] || 0) + 1;
                }
                if (p.teacher) {
                    summary.teachers[p.teacher.user.name] = (summary.teachers[p.teacher.user.name] || 0) + 1;
                }
                if (p.timetable.class) {
                    const className = p.timetable.class.name || p.timetable.class.sortName;
                    if (!summary.classes[className]) {
                        summary.classes[className] = {
                            sections: new Set(),
                            count: 0
                        };
                    }
                    summary.classes[className].sections.add(p.timetable.section?.name || p.timetable.section?.sectionName);
                    summary.classes[className].count += 1;
                }
            });

            // Convert Sets to Arrays in summary
            Object.keys(summary.classes).forEach(key => {
                summary.classes[key].sections = Array.from(summary.classes[key].sections);
            });

            result.data = {
                timetables: timetables.map(t => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    class: t.class,
                    section: t.section
                })),
                classes: timetables.map(t => t.class),
                sections: timetables.map(t => t.section),
                session: timetables[0]?.session,
                config: config ? {
                    id: config.id,
                    startTime: config.startTime,
                    endTime: config.endTime,
                    slotDuration: config.slotDuration,
                    breakDuration: config.breakDuration,
                    lunchDuration: config.lunchDuration,
                    totalSlotsPerDay: config.totalSlotsPerDay,
                    schoolDays: config.schoolDays,
                    isActive: config.isActive,
                    periods: config.periods.map(p => ({
                        id: p.id,
                        periodNo: p.periodNo,
                        name: p.name,
                        startTime: p.startTime,
                        endTime: p.endTime,
                        isBreak: p.isBreak,
                        status: p.status
                    }))
                } : null,
                selectedDay,
                periods: formattedPeriods,
                periodsByDay: day ? null : periodsByDay,
                periodCount: periods.length,
                totalPeriods: allPeriods.length
            };

            result.summary = summary;

        } else if (viewType === 'teacher') {
            // Get teacher details for all selected teachers
            const teachers = await prisma.teacher.findMany({
                where: {
                    id: {
                        in: teacherIdArray
                    },
                    schoolId
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,

                            mobile: true
                        }
                    },
                    subjects: {
                        include: {
                            subject: {
                                select: {
                                    id: true,
                                    subjectName: true,
                                    subjectCode: true,

                                }
                            },
                            class: {
                                select: {
                                    id: true,
                                    className: true,
                                    sortName: true,

                                }
                            },
                            section: {
                                select: {
                                    id: true,
                                    sectionName: true,

                                }
                            }
                        }
                    }
                }
            });

            if (teachers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Teachers not found'
                });
            }

            // Get all periods for all selected teachers
            const periods = await prisma.timetablePeriod.findMany({
                where: {
                    teacherId: {
                        in: teacherIdArray
                    },
                    timetable: {
                        schoolId,
                        sessionId: currentSessionId,
                        status: 'PUBLISHED'
                    }
                },
                include: {
                    timetable: {
                        include: {
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
                            session: {
                                select: {
                                    id: true,
                                    sessionName: true
                                }
                            }
                        }
                    },
                    subject: {
                        select: {
                            id: true,

                            subjectName: true,

                            subjectCode: true
                        }
                    },
                    periodMaster: true
                },
                orderBy: [
                    { day: 'asc' },
                    { periodMaster: { periodNo: 'asc' } }
                ]
            });

            if (periods.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No timetable found for selected teachers'
                });
            }

            // Filter by day if provided
            let filteredPeriods = periods;
            let selectedDay = day;
            if (day) {
                const dayUpper = day.toUpperCase();
                filteredPeriods = periods.filter(p => p.day === dayUpper);
                selectedDay = dayUpper;
            }

            // Group periods by day
            const weekDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
            const periodsByDay = {};
            weekDays.forEach(dayName => {
                periodsByDay[dayName] = periods
                    .filter(p => p.day === dayName)
                    .map(p => ({
                        periodNo: p.periodMaster.periodNo,
                        periodName: p.periodMaster.name,
                        startTime: p.periodMaster.startTime,
                        endTime: p.periodMaster.endTime,
                        class: p.timetable.class?.name || p.timetable.class?.sortName || null,
                        classId: p.timetable.class?.id || null,
                        section: p.timetable.section?.name || p.timetable.section?.sectionName || null,
                        sectionId: p.timetable.section?.id || null,
                        subject: p.subject?.subjectName || p.subject?.name || null,
                        subjectId: p.subject?.id || null,
                        roomNo: p.roomNo || null,
                        timetableId: p.timetable.id,
                        timetableName: p.timetable.name,
                        teacherId: p.teacherId,
                        teacherName: teachers.find(t => t.id === p.teacherId)?.user?.name || null
                    }));
            });

            // Format periods for response
            const formattedPeriods = filteredPeriods.map(p => {
                const teacher = teachers.find(t => t.id === p.teacherId);
                return {
                    id: p.id,
                    day: p.day,
                    periodNo: p.periodMaster.periodNo,
                    periodName: p.periodMaster.name,
                    startTime: p.periodMaster.startTime,
                    endTime: p.periodMaster.endTime,
                    subject: p.subject ? {
                        id: p.subject.id,
                        subjectName: p.subject.subjectName || p.subject.name,
                        subjectCode: p.subject.subjectCode || p.subject.code
                    } : null,
                    class: p.timetable.class ? {
                        id: p.timetable.class.id,
                        sortName: p.timetable.class.sortName
                    } : null,
                    section: p.timetable.section ? {
                        id: p.timetable.section.id,
                        sectionName: p.timetable.section.name || p.timetable.section.sectionName
                    } : null,
                    roomNo: p.roomNo,
                    timetable: {
                        id: p.timetable.id,
                        name: p.timetable.name
                    },
                    teacher: teacher ? {
                        id: teacher.id,
                        name: teacher.user.name,
                        email: teacher.user.email
                    } : null
                };
            });

            // Generate summary
            const summary = {
                totalPeriods: periods.length,
                totalTeachers: teachers.length,
                totalClasses: new Set(periods.map(p => p.timetable.classId)).size,
                daysWithPeriods: {},
                classes: {},
                subjects: {},
                teachers: {}
            };

            weekDays.forEach(dayName => {
                const dayPeriods = periods.filter(p => p.day === dayName);
                const classList = [...new Set(dayPeriods.map(p => p.timetable.class?.name || p.timetable.class?.sortName).filter(Boolean))];
                summary.daysWithPeriods[dayName] = {
                    count: dayPeriods.length,
                    classes: classList,
                    teachers: [...new Set(dayPeriods.map(p => {
                        const teacher = teachers.find(t => t.id === p.teacherId);
                        return teacher?.user?.name;
                    }).filter(Boolean))]
                };
            });

            periods.forEach(p => {
                if (p.timetable.class) {
                    const key = p.timetable.class.name || p.timetable.class.sortName;
                    if (!summary.classes[key]) {
                        summary.classes[key] = {
                            section: p.timetable.section?.name || p.timetable.section?.sectionName || null,
                            count: 0
                        };
                    }
                    summary.classes[key].count += 1;
                }
                if (p.subject) {
                    const subjectName = p.subject.subjectName || p.subject.name;
                    summary.subjects[subjectName] = (summary.subjects[subjectName] || 0) + 1;
                }
                if (p.teacherId) {
                    const teacher = teachers.find(t => t.id === p.teacherId);
                    const teacherName = teacher?.user?.name;
                    if (teacherName) {
                        summary.teachers[teacherName] = (summary.teachers[teacherName] || 0) + 1;
                    }
                }
            });

            // Get weekly schedule summary for quick view
            const weeklySchedule = {};
            weekDays.forEach(dayName => {
                const dayPeriods = periods.filter(p => p.day === dayName);
                weeklySchedule[dayName] = dayPeriods.map(p => {
                    const teacher = teachers.find(t => t.id === p.teacherId);
                    return {
                        periodNo: p.periodMaster.periodNo,
                        periodName: p.periodMaster.name,
                        subject: p.subject?.subjectName || p.subject?.name || 'Free',
                        class: p.timetable.class?.name || p.timetable.class?.sortName || '',
                        section: p.timetable.section?.name || p.timetable.section?.sectionName || '',
                        teacher: teacher?.user?.name || ''
                    };
                });
            });

            result.data = {
                teachers: teachers.map(t => ({
                    id: t.id,
                    name: t.user.name,
                    email: t.user.email,
                    mobile: t.user.phone || t.user.mobile,
                    subjects: t.subjects.map(s => ({
                        id: s.id,
                        name: s.subject?.subjectName || s.subject?.name,
                        code: s.subject?.subjectCode || s.subject?.code,
                        class: s.class?.name || s.class?.sortName,
                        section: s.section?.name || s.section?.sectionName
                    }))
                })),
                selectedDay,
                periods: formattedPeriods,
                periodsByDay: day ? null : periodsByDay,
                weeklySchedule: day ? null : weeklySchedule,
                periodCount: filteredPeriods.length,
                totalPeriods: periods.length
            };

            result.summary = summary;
        }

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error fetching timetable report:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timetable report',
            error: error.message
        });
    }
};