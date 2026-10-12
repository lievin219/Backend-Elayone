"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const reminder_serialization_1 = require("./reminder-serialization");
const router = (0, express_1.Router)();
router.get('/:choirId/reminders', auth_1.requireChoirAccess, async (request, response) => {
    const choirId = String(request.params.choirId);
    const userId = request.userId;
    const viewer = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId, startsAt: { gte: now, lte: horizon } },
        include: {
            attendances: { select: { userId: true, status: true } },
            invitations: { select: { userId: true } },
        },
        orderBy: { startsAt: 'asc' },
    });
    return response.json((0, reminder_serialization_1.buildEventReminders)(events, userId, canManage, now));
});
exports.default = router;
