"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const shared_1 = require("./shared");
const router = (0, express_1.Router)();
router.get('/:choirId/rehearsals', auth_1.requireChoirAccess, async (request, response) => {
    const userId = request.userId;
    const choirId = String(request.params.choirId);
    const viewer = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
    const rehearsals = await prisma_1.prisma.rehearsal.findMany({
        where: { choirId },
        orderBy: { startsAt: 'asc' },
        include: {
            attendances: { select: { userId: true, status: true } },
            invitations: { include: { user: { select: { id: true, name: true } } } },
            eventSongs: shared_1.eventSongInclude,
        },
    });
    const choirMembers = canManage ? await prisma_1.prisma.membership.findMany({
        where: { choirId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: 'asc' } },
    }) : [];
    const visibleEvents = rehearsals.filter((event) => canManage || event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId));
    return response.json(visibleEvents.map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.eventType,
        customEventType: event.customEventType,
        eventTypeName: event.customEventType ?? event.eventType,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceIndex: event.recurrenceIndex,
        recurrenceTotal: event.recurrenceTotal,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        createdAt: event.createdAt,
        invitationOnly: event.invitations.length > 0,
        invited: event.invitations.length === 0 || event.invitations.some((invitation) => invitation.userId === userId),
        myStatus: event.attendances.find((attendance) => attendance.userId === userId)?.status ?? 'PENDING',
        confirmedCount: event.attendances.filter((attendance) => attendance.status === 'YES').length,
        songs: (0, shared_1.serializeEventSongs)(event.eventSongs),
        invitees: canManage ? (event.invitations.length > 0
            ? event.invitations.map((invitation) => ({ userId: invitation.userId, name: invitation.user.name }))
            : choirMembers.map((member) => ({ userId: member.user.id, name: member.user.name }))).map((invitee) => ({
            ...invitee,
            status: event.attendances.find((attendance) => attendance.userId === invitee.userId)?.status ?? 'PENDING',
        })) : undefined,
    })));
});
exports.default = router;
