exports.store = async (req, res) => {
    try {

        const schoolId = req.user.schoolId;

        const {
            sessionId,
            classId,
            name,
            status = true,
            items
        } = req.body;

        // Validation
        if (!sessionId || !classId || !name) {
            return res.status(400).json({
                success: false,
                message: "Session, Class and Name are required."
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one Fee Head."
            });
        }

        // Duplicate Check
        const exist = await prisma.feeStructure.findFirst({
            where: {
                schoolId,
                sessionId,
                classId
            }
        });

        if (exist) {
            return res.status(409).json({
                success: false,
                message: "Fee Structure already exists for this class."
            });
        }

        // Transaction
        const feeStructure = await prisma.$transaction(async (tx) => {

            const structure = await tx.feeStructure.create({
                data: {
                    schoolId,
                    sessionId,
                    classId,
                    name,
                    status
                }
            });

            await tx.feeStructureItem.createMany({
                data: items.map(item => ({
                    feeStructureId: structure.id,
                    feeHeadId: item.feeHeadId,
                    amount: Number(item.amount)
                }))
            });

            return structure;

        });

        const result = await prisma.feeStructure.findUnique({
            where: {
                id: feeStructure.id
            },
            include: {
                session: true,
                class: true,
                items: {
                    include: {
                        feeHead: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: "Fee Structure created successfully.",
            data: result
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};