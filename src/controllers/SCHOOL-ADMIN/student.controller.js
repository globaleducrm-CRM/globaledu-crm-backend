const { PrismaClient } = require("@prisma/client");
const { getPagination, getPaginationMeta } = require("../../utils/pagination");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const emailTemplate = require("../../utils/emailTemplate");
const { sendParentWelcomeEmail, sendStudentWelcomeEmail } = require("../../utils/emailHelpers");

const prisma = new PrismaClient();


exports.generateAdmissionNo = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;

        // School
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: {
                schoolCode: true,
            },
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found.",
            });
        }

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

        // Total Students of Current Session
        const totalStudents = await prisma.student.count({
            where: {
                schoolId,
                sessionId: currentSession.id,
            },
        });

        const year = currentSession.startDate.getFullYear();

        const serial = String(totalStudents + 1).padStart(6, "0");

        const admissionNo = `${school.schoolCode}-${year}-${serial}`;

        return res.status(200).json({
            success: true,
            message: "Admission number generated successfully.",
            data: {
                admissionNo,
            },
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


// student.controller.js
exports.store = async (req, res) => {
    let createdStudent = null;
    let createdStudentUser = null;
    let createdParents = [];
    let createdParentUsers = [];

    try {
        let {
            classId,
            sectionId,
            admissionNo,
            rollNo,
            admissionDate,
            firstName,
            middleName,
            lastName,
            gender,
            dob,
            bloodGroup,
            studentEmail,
            mobile,

            fatherName,
            fatherMobile,
            fatherEmail,
            motherName,
            motherMobile,
            motherEmail,
            address,
            city,
            nationality,
        } = req.body;

        // Validate required fields
        if (!classId || !sectionId || !admissionNo || !firstName || !gender || !dob ||
            !fatherName || !fatherMobile || !motherName || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if school exists
        const school = await prisma.school.findUnique({
            where: { id: req.user.schoolId }
        });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: "School not found."
            });
        }

        // Check if school is approved
        if (school.status !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "School is not approved. Please contact super admin."
            });
        }

        // Get STUDENT and PARENT roles
        const [studentRole, parentRole] = await Promise.all([
            prisma.role.findUnique({
                where: { name: "STUDENT" }
            }),
            prisma.role.findUnique({
                where: { name: "PARENT" }
            })
        ]);

        if (!studentRole || !parentRole) {
            return res.status(404).json({
                success: false,
                message: "Student or Parent role not found."
            });
        }

        // Check for duplicate admission number
        const existingStudent = await prisma.student.findFirst({
            where: {
                schoolId: req.user.schoolId,
                admissionNo: admissionNo
            }
        });

        if (existingStudent) {
            return res.status(409).json({
                success: false,
                message: `Student with admission number ${admissionNo} already exists.`
            });
        }

        // Check if student email already exists
        if (studentEmail) {
            const existingUser = await prisma.user.findUnique({
                where: { email: studentEmail }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Student email already exists in user system."
                });
            }
        }

        // Check if student mobile already exists
        if (mobile) {
            const existingUser = await prisma.user.findFirst({
                where: { mobile: mobile }
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Student mobile number already exists in user system."
                });
            }
        }

        // Check if parent emails already exist
        const parentEmails = [];
        if (fatherEmail) parentEmails.push(fatherEmail);
        if (motherEmail) parentEmails.push(motherEmail);

        if (parentEmails.length > 0) {
            const existingUsers = await prisma.user.findMany({
                where: {
                    email: { in: parentEmails }
                }
            });
            if (existingUsers.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Email(s) already exist: ${existingUsers.map(u => u.email).join(', ')}`
                });
            }
        }

        // Check if parent mobiles already exist
        const parentMobiles = [];
        if (fatherMobile) parentMobiles.push({ mobile: fatherMobile, name: fatherName, role: 'Father' });
        if (motherMobile) parentMobiles.push({ mobile: motherMobile, name: motherName, role: 'Mother' });

        if (parentMobiles.length > 0) {
            const existingUsers = await prisma.user.findMany({
                where: {
                    mobile: { in: parentMobiles.map(p => p.mobile) }
                }
            });
            if (existingUsers.length > 0) {
                const duplicateDetails = existingUsers.map(user => {
                    const parentInfo = parentMobiles.find(p => p.mobile === user.mobile);
                    return `${parentInfo?.role} ${parentInfo?.name} (${user.mobile})`;
                }).join(', ');

                return res.status(409).json({
                    success: false,
                    message: `Mobile number(s) already exist: ${duplicateDetails}`,
                    suggestion: "Please ensure you're using unique mobile numbers for each parent. Contact school admin if you need to reuse existing parent accounts."
                });
            }
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

        // Generate Password function
        const generatePassword = () => {
            return crypto
                .randomBytes(8)
                .toString("base64")
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 10);
        };

        // Create Student User
        let studentUser = null;
        let studentPassword = null;

        if (studentEmail) {
            studentPassword = generatePassword();

            console.log("Generated student studentEmail:", studentEmail);
            console.log("Generated student password:", studentPassword);
            const hashedStudentPassword = await bcrypt.hash(studentPassword, 10);

            studentUser = await prisma.user.create({
                data: {
                    schoolId: req.user.schoolId,
                    roleId: studentRole.id,
                    name: `${firstName} ${lastName || ''}`.trim(),
                    email: studentEmail,
                    mobile: mobile,
                    password: hashedStudentPassword,
                    isActive: true
                }
            });
            createdStudentUser = studentUser;
        }

        // Create Student FIRST
        const student = await prisma.student.create({
            data: {
                schoolId: req.user.schoolId,
                sessionId: currentSession.id,
                userId: studentUser?.id || null,
                classId: classId,
                sectionId: sectionId,
                admissionNo: admissionNo,
                rollNo: rollNo ? parseInt(rollNo) : null,
                admissionDate: new Date(admissionDate),
                firstName: firstName,
                middleName: middleName || null,
                lastName: lastName || null,
                email: studentEmail || null,
                mobile: mobile || null,
                gender: gender,
                dob: dob ? new Date(dob) : null,
                bloodGroup: bloodGroup || null,
                nationality: nationality || "India",
            }
        });
        createdStudent = student;

        // Create Parent Users and Parents
        const parentCredentials = [];
        let createdFather = null;
        let createdMother = null;

        // Create Father
        if (fatherEmail) {
            try {
                // Check if father mobile already exists before creating
                if (fatherMobile) {
                    const existingFatherUser = await prisma.user.findFirst({
                        where: { mobile: fatherMobile }
                    });
                    if (existingFatherUser) {
                        return res.status(409).json({
                            success: false,
                            message: `Father's mobile number ${fatherMobile} already exists in user system.`
                        });
                    }
                }

                const fatherPassword = generatePassword();

                console.log("Generated father fatherEmail:", fatherEmail);
                console.log("Generated father password:", fatherPassword);
                const hashedFatherPassword = await bcrypt.hash(fatherPassword, 10);

                const fatherUser = await prisma.user.create({
                    data: {
                        schoolId: req.user.schoolId,
                        roleId: parentRole.id,
                        name: fatherName,
                        email: fatherEmail,
                        mobile: fatherMobile,
                        password: hashedFatherPassword,
                        isActive: true
                    }
                });
                createdParentUsers.push(fatherUser);

                // Create Parent record WITH studentId
                createdFather = await prisma.parent.create({
                    data: {
                        schoolId: req.user.schoolId,
                        userId: fatherUser.id,

                        fatherName: fatherName,
                        fatherMobile: fatherMobile,
                        fatherEmail: fatherEmail,
                        motherName: motherName || null,
                        motherMobile: motherMobile || null,
                        motherEmail: motherEmail || null,
                        address: address || null,
                        city: city || null,
                    }
                });
                createdParents.push(createdFather);

                parentCredentials.push({
                    name: fatherName,
                    email: fatherEmail,
                    password: fatherPassword,
                    relationship: "Father"
                });
            } catch (error) {
                console.error("Error creating father:", error);
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0] || 'field';
                    return res.status(409).json({
                        success: false,
                        message: `Father's ${field} already exists in the system.`
                    });
                }
                await cleanupCreatedData(createdStudent, createdStudentUser);
                throw new Error(`Failed to create father account: ${error.message}`);
            }
        }

        // Create Mother
        if (motherEmail) {
            try {
                // Check if mother mobile already exists before creating
                if (motherMobile) {
                    const existingMotherUser = await prisma.user.findFirst({
                        where: { mobile: motherMobile }
                    });
                    if (existingMotherUser) {
                        return res.status(409).json({
                            success: false,
                            message: `Mother's mobile number ${motherMobile} already exists in user system.`
                        });
                    }
                }

                const motherPassword = generatePassword();
                const hashedMotherPassword = await bcrypt.hash(motherPassword, 10);

                const motherUser = await prisma.user.create({
                    data: {
                        schoolId: req.user.schoolId,
                        roleId: parentRole.id,
                        name: motherName,
                        email: motherEmail,
                        mobile: motherMobile,
                        password: hashedMotherPassword,
                        isActive: true
                    }
                });
                createdParentUsers.push(motherUser);

                // Create Parent record WITH studentId
                createdMother = await prisma.parent.create({
                    data: {
                        schoolId: req.user.schoolId,
                        userId: motherUser.id,
                        studentId: student.id, // 🔥 FIX: Add studentId here
                        fatherName: fatherName || null,
                        fatherMobile: fatherMobile || null,
                        fatherEmail: fatherEmail || null,
                        motherName: motherName,
                        motherMobile: motherMobile,
                        motherEmail: motherEmail,
                        address: address || null,
                        city: city || null,
                    }
                });
                createdParents.push(createdMother);

                parentCredentials.push({
                    name: motherName,
                    email: motherEmail,
                    password: motherPassword,
                    relationship: "Mother"
                });
            } catch (error) {
                console.error("Error creating mother:", error);
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0] || 'field';
                    return res.status(409).json({
                        success: false,
                        message: `Mother's ${field} already exists in the system.`
                    });
                }
                await cleanupCreatedData(createdStudent, createdStudentUser, createdParents, createdParentUsers);
                throw new Error(`Failed to create mother account: ${error.message}`);
            }
        }

        // Update student with parentId
        let updatedStudent = null;
        if (createdFather) {
            updatedStudent = await prisma.student.update({
                where: { id: student.id },
                data: {
                    parentId: createdFather.id
                },
                include: {
                    user: true,
                    class: true,
                    section: true,
                    session: true
                }
            });
            createdStudent = updatedStudent;
        } else if (createdMother) {
            updatedStudent = await prisma.student.update({
                where: { id: student.id },
                data: {
                    parentId: createdMother.id
                },
                include: {
                    user: true,
                    class: true,
                    section: true,
                    session: true
                }
            });
            createdStudent = updatedStudent;
        }

        // Send Emails
        const emailResults = [];

        // Send Student Email
        if (studentUser && studentPassword) {
            try {
                await sendStudentWelcomeEmail(
                    `${firstName} ${lastName || ''}`,
                    studentUser.email,
                    studentPassword,
                    admissionNo,
                    fatherName,
                    motherName,
                    school.name
                );
                emailResults.push({
                    email: studentUser.email,
                    type: 'student',
                    status: 'sent'
                });
            } catch (error) {
                console.error('Failed to send student email:', error);
                emailResults.push({
                    email: studentUser.email,
                    type: 'student',
                    status: 'failed',
                    error: error.message
                });
            }
        }

        // Send Parent Emails
        for (const parent of parentCredentials) {
            try {
                await sendParentWelcomeEmail(
                    parent.name,
                    parent.email,
                    parent.password,
                    parent.relationship,
                    `${firstName} ${lastName || ''}`,
                    admissionNo,
                    school.name
                );
                emailResults.push({
                    email: parent.email,
                    type: 'parent',
                    status: 'sent',
                    relationship: parent.relationship
                });
            } catch (error) {
                console.error(`Failed to send email to ${parent.email}:`, error);
                emailResults.push({
                    email: parent.email,
                    type: 'parent',
                    status: 'failed',
                    relationship: parent.relationship,
                    error: error.message
                });
            }
        }

        // Prepare response
        const studentResponse = {
            ...createdStudent,
            user: studentUser ? {
                id: studentUser.id,
                email: studentUser.email,
                name: studentUser.name
            } : null
        };

        // Remove sensitive data
        if (studentResponse.user) {
            delete studentResponse.user.password;
        }

        return res.status(201).json({
            success: true,
            message: emailResults.some(e => e.status === 'sent')
                ? 'Student and parent accounts created successfully. Login credentials sent to email(s).'
                : 'Student and parent accounts created successfully but some emails could not be sent. Please contact admin.',
            data: {
                student: studentResponse,
                parents: createdParents.map(p => ({
                    id: p.id,
                    fatherName: p.fatherName,
                    fatherMobile: p.fatherMobile,
                    fatherEmail: p.fatherEmail,
                    motherName: p.motherName,
                    motherMobile: p.motherMobile,
                    motherEmail: p.motherEmail,
                    address: p.address,
                    city: p.city
                })),
                emailResults: emailResults
            }
        });

    } catch (error) {
        console.error("❌ Store Student Error:", error);
        console.error("❌ Error stack:", error.stack);

        // Cleanup created data on error
        await cleanupCreatedData(createdStudent, createdStudentUser, createdParents, createdParentUsers);

        // Handle Prisma unique constraint errors
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `Duplicate entry for ${field}. Please check and try again.`
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error",
        });
    }
};

// Cleanup function to delete created data on error
async function cleanupCreatedData(student, studentUser, parents = [], parentUsers = []) {
    try {
        // Delete parents first (in reverse order)
        for (const parent of parents) {
            try {
                await prisma.parent.delete({
                    where: { id: parent.id }
                });
                console.log(`✅ Deleted parent: ${parent.id}`);
            } catch (e) {
                console.error(`Error deleting parent ${parent.id}:`, e);
            }
        }

        // Delete parent users
        for (const parentUser of parentUsers) {
            try {
                await prisma.user.delete({
                    where: { id: parentUser.id }
                });
                console.log(`✅ Deleted parent user: ${parentUser.id}`);
            } catch (e) {
                console.error(`Error deleting parent user ${parentUser.id}:`, e);
            }
        }

        // Delete student
        if (student) {
            try {
                await prisma.student.delete({
                    where: { id: student.id }
                });
                console.log(`✅ Deleted student: ${student.id}`);
            } catch (e) {
                console.error(`Error deleting student ${student.id}:`, e);
            }
        }

        // Delete student user
        if (studentUser) {
            try {
                await prisma.user.delete({
                    where: { id: studentUser.id }
                });
                console.log(`✅ Deleted student user: ${studentUser.id}`);
            } catch (e) {
                console.error(`Error deleting student user ${studentUser.id}:`, e);
            }
        }

        console.log("✅ Cleanup completed successfully");
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    }
}


exports.index = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req);
        const search = req.query.search?.trim() || "";
        const { classId, sectionId } = req.query;

        const whereClause = {
            schoolId: req.user.schoolId,
            
        };

        if (classId) {
            whereClause.classId = classId;
        }

         if (sectionId) {
            whereClause.sectionId = sectionId;
        }


        if (search) {
            whereClause.OR = [
                {
                    firstName: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    lastName: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        const [students, total] = await Promise.all([
            prisma.student.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            mobile: true,
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
                    parent: {
                        select: {
                            id: true,
                            fatherName: true,
                            fatherMobile: true,
                            fatherEmail: true,
                            motherName: true,
                            motherMobile: true,
                            motherEmail: true,
                             city:true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),

            prisma.student.count({
                where: whereClause,
            }),
        ]);

        return res.status(200).json({
            success: true,
            data: students,
            pagination: getPaginationMeta(page, limit, total),
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.show = async(req, res) => {
    try {
        const studentId = req.params.id;

        const student = await prisma.student.findUnique({
            where: {
                id: studentId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
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
                parent: {
                    select: {
                        id: true,
                        fatherName: true,
                        fatherMobile: true,
                        fatherEmail: true,
                        motherName: true,
                        motherMobile: true,
                        motherEmail: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Student retrieved successfully.",
            data: student,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving the student.",
        });
    }
};



exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Student Basic Fields
      classId,
      sectionId,
      admissionNo,
      rollNo,
      admissionDate,
      firstName,
      middleName,
      lastName,
      studentEmail,
      mobile,
      gender,
      dob,
      bloodGroup,
      nationality,
      religion,
      caste,
      category,
      previousSchool,
      medicalHistory,
      image,
      
      // Address Fields
      address,
      city,
      state,
      pincode,
      country,
      
      // Physical Fields
      height,
      weight,
      
      // Hostel
      hostel,
      
      // Parent Fields
      fatherName,
      fatherMobile,
      fatherEmail,
      motherName,
      motherMobile,
      motherEmail,
      fatherOccupation,
      motherOccupation,
      fatherAadhaar,
      motherAadhaar,
      annualIncome,
      officeAddress,
      
      // Transport Fields
      transport,
      
      // Emergency Contact
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelation,
      
      // Session
      sessionId
    } = req.body;

    // ============================================
    // 1. VALIDATION
    // ============================================
    
    const validationErrors = {};

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { id },
      include: { parent: true }
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Required field validations
    if (!firstName || firstName.trim() === '') {
      validationErrors.firstName = 'First name is required';
    }
    
    if (!lastName || lastName.trim() === '') {
      validationErrors.lastName = 'Last name is required';
    }
    
    if (!admissionNo || admissionNo.trim() === '') {
      validationErrors.admissionNo = 'Admission number is required';
    }
    
    if (!studentEmail || studentEmail.trim() === '') {
      validationErrors.studentEmail = 'Email is required';
    } else if (!isValidEmail(studentEmail)) {
      validationErrors.studentEmail = 'Invalid email format';
    }
    
    if (!dob) {
      validationErrors.dob = 'Date of birth is required';
    }
    
    if (!classId) {
      validationErrors.classId = 'Class is required';
    }
    
    if (!sessionId) {
      validationErrors.sessionId = 'Session is required';
    }

    // Parent validations
    if (!fatherName || fatherName.trim() === '') {
      validationErrors.fatherName = 'Father name is required';
    }
    
    if (!fatherMobile || fatherMobile.trim() === '') {
      validationErrors.fatherMobile = 'Father mobile is required';
    } else if (!isValidPhone(fatherMobile)) {
      validationErrors.fatherMobile = 'Invalid mobile number';
    }
    
    if (!fatherEmail || fatherEmail.trim() === '') {
      validationErrors.fatherEmail = 'Father email is required';
    } else if (!isValidEmail(fatherEmail)) {
      validationErrors.fatherEmail = 'Invalid email format';
    }

    // Check for duplicate admission number (excluding current student)
    if (admissionNo) {
      const duplicateAdmission = await prisma.student.findFirst({
        where: {
          admissionNo,
          schoolId: existingStudent.schoolId,
          id: { not: id }
        }
      });
      
      if (duplicateAdmission) {
        validationErrors.admissionNo = 'Admission number already exists';
      }
    }

    // Check for duplicate email (excluding current student)
    if (studentEmail) {
      const duplicateEmail = await prisma.student.findFirst({
        where: {
          email: studentEmail,
          schoolId: existingStudent.schoolId,
          id: { not: id }
        }
      });
      
      if (duplicateEmail) {
        validationErrors.studentEmail = 'Email already exists';
      }
    }

    // If validation errors exist, return them
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // ============================================
    // 2. UPDATE STUDENT
    // ============================================
    
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        classId: classId || null,
        sectionId: sectionId || null,
        sessionId: sessionId || existingStudent.sessionId,
        
        admissionNo: admissionNo?.trim(),
        rollNo: rollNo ? Number(rollNo) : null,
        
        admissionDate: admissionDate 
          ? new Date(admissionDate) 
          : existingStudent.admissionDate,
        
        image: image || null,
        
        firstName: firstName?.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName?.trim(),
        
        email: studentEmail?.trim(),
        mobile: mobile?.trim() || null,
        
        gender: gender || null,
        dob: dob ? new Date(dob) : null,
        
        bloodGroup: bloodGroup || null,
        nationality: nationality || 'India',
        
        religion: religion || null,
        caste: caste || null,
        category: category || null,
        
        previousSchool: previousSchool || null,
        medicalHistory: medicalHistory || null,
        
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        
        hostel: typeof hostel === 'boolean' ? hostel : false,
        
        transport: transport?.required ?? false,
        
        emergencyContactName: emergencyContactName || null,
        emergencyContactNumber: emergencyContactNumber || null,
        emergencyContactRelation: emergencyContactRelation || null
      }
    });

    // ============================================
    // 3. UPDATE STUDENT USER
    // ============================================
    
    if (existingStudent.userId) {
      await prisma.user.update({
        where: {
          id: existingStudent.userId
        },
        data: {
          name: `${firstName?.trim() || ''} ${lastName?.trim() || ''}`.trim(),
          email: studentEmail?.trim(),
          mobile: mobile?.trim() || null
        }
      });
    }

    // ============================================
    // 4. UPDATE OR CREATE PARENT
    // ============================================
    
    if (existingStudent.parentId) {
      // Update existing parent
      const updatedParent = await prisma.parent.update({
        where: {
          id: existingStudent.parentId
        },
        data: {
          fatherName: fatherName?.trim(),
          fatherMobile: fatherMobile?.trim(),
          fatherEmail: fatherEmail?.trim(),
          
          motherName: motherName?.trim() || null,
          motherMobile: motherMobile?.trim() || null,
          motherEmail: motherEmail?.trim() || null,
          
          fatherOccupation: fatherOccupation || null,
          motherOccupation: motherOccupation || null,
          
          fatherAadhaar: fatherAadhaar || null,
          motherAadhaar: motherAadhaar || null,
          
          annualIncome: annualIncome ? parseFloat(annualIncome) : null,
          officeAddress: officeAddress || null,
          
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null
        }
      });

      // Update parent user if exists
      if (updatedParent.userId) {
        await prisma.user.update({
          where: {
            id: updatedParent.userId
          },
          data: {
            name: fatherName?.trim(),
            email: fatherEmail?.trim(),
            mobile: fatherMobile?.trim()
          }
        });
      }
    } else {
      // Create new parent if not exists
      const newParent = await prisma.parent.create({
        data: {
          schoolId: existingStudent.schoolId,
          fatherName: fatherName?.trim(),
          fatherMobile: fatherMobile?.trim(),
          fatherEmail: fatherEmail?.trim(),
          motherName: motherName?.trim() || null,
          motherMobile: motherMobile?.trim() || null,
          motherEmail: motherEmail?.trim() || null,
          fatherOccupation: fatherOccupation || null,
          motherOccupation: motherOccupation || null,
          fatherAadhaar: fatherAadhaar || null,
          motherAadhaar: motherAadhaar || null,
          annualIncome: annualIncome ? parseFloat(annualIncome) : null,
          officeAddress: officeAddress || null,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          status: true
        }
      });

      // Link parent to student
      await prisma.student.update({
        where: { id },
        data: {
          parentId: newParent.id
        }
      });
    }

    // ============================================
    // 5. UPDATE OR CREATE TRANSPORT
    // ============================================
    
    if (transport) {
      const transportExist = await prisma.studentTransport.findUnique({
        where: {
          studentId: id
        }
      });

      if (transportExist) {
        await prisma.studentTransport.update({
          where: {
            studentId: id
          },
          data: {
            required: transport.required ?? false,
            pickupPoint: transport.pickupPoint || null,
            pickupTime: transport.pickupTime || null,
            dropTime: transport.dropTime || null,
            conductorName: transport.conductorName || null,
            conductorPhone: transport.conductorPhone || null
          }
        });
      } else {
        await prisma.studentTransport.create({
          data: {
            studentId: id,
            required: transport.required ?? false,
            pickupPoint: transport.pickupPoint || null,
            pickupTime: transport.pickupTime || null,
            dropTime: transport.dropTime || null,
            conductorName: transport.conductorName || null,
            conductorPhone: transport.conductorPhone || null
          }
        });
      }
    } else {
      // If transport data is not provided, delete existing transport if any
      await prisma.studentTransport.deleteMany({
        where: {
          studentId: id
        }
      });
    }

    // ============================================
    // 6. FETCH UPDATED STUDENT DATA
    // ============================================
    
    const data = await prisma.student.findUnique({
      where: {
        id
      },
      include: {
        class: true,
        section: true,
        session: true,
        parent: true,
        transportInfo: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true
          }
        }
      }
    });

    // ============================================
    // 7. RETURN RESPONSE
    // ============================================
    
    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data
    });

  } catch (error) {
    console.error('Error updating student:', error);
    
    // Handle Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found',
        error: error.meta?.target
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
};

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone);
}

