"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const attendance_report_events_1 = require("./attendance-report-events");
const attendance_report_members_1 = require("./attendance-report-members");
const router = (0, express_1.Router)();
router.get('/:choirId/attendance/report', auth_1.requireChoirAccess, async (request, response) => {
    const choirId = String(request.params.choirId);
    const userId = request.userId;
    const [viewer, choir] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        prisma_1.prisma.choir.findUnique({ where: { id: choirId }, select: { id: true } }),
    ]);
    if (!choir)
        return response.status(404).json({ message: 'Ministry not found.' });
    const canViewAll = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const memberships = await prisma_1.prisma.membership.findMany({
        where: { choirId, ...(canViewAll ? {} : { userId }) },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: 'asc' } },
    });
    if (!canViewAll && memberships.length === 0)
        return response.status(403).json({ message: 'You must be part of this ministry to view attendance.' });
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId },
        include: { attendances: { select: { userId: true, status: true } }, invitations: { select: { userId: true } } },
        orderBy: { startsAt: 'desc' },
    });
    const members = (0, attendance_report_members_1.buildAttendanceMembers)(memberships, rehearsals, canViewAll);
    const report = (0, attendance_report_events_1.buildAttendanceEvents)(members, rehearsals);
    return response.json({
        scope: canViewAll ? 'choir' : 'member',
        generatedAt: new Date().toISOString(),
        summary: { members: members.length, rehearsals: rehearsals.length, total: report.total, ...report.summary, responseRate: report.total ? Math.round((report.responded / report.total) * 100) : 0 },
        events: report.events,
        members,
    });
});
exports.default = router;
