"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/:choirId/attendance/summary', auth_1.requireChoirAccess, async (request, response) => {
    const userId = request.userId;
    const choirId = String(request.params.choirId);
    const [total, confirmed, upcoming] = await Promise.all([
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
        prisma_1.prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
        prisma_1.prisma.rehearsal.count({
            where: {
                choirId,
                startsAt: { gte: new Date() },
                OR: [
                    { invitations: { none: {} } },
                    { invitations: { some: { userId } } },
                ],
            },
        }),
    ]);
    return response.json({ total, confirmed, rate: total ? Math.round((confirmed / total) * 100) : 0, upcoming });
});
exports.default = router;
