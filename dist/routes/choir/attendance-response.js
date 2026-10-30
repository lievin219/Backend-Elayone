"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/:choirId/rehearsals/:rehearsalId/attendance', auth_1.requireChoirAccess, async (request, response) => {
    const body = request.body ?? {};
    const statuses = ['YES', 'MAYBE', 'NO'];
    const status = typeof body.status === 'string' && statuses.includes(body.status)
        ? body.status
        : null;
    if (!status)
        return response.status(400).json({ message: 'Choose YES, MAYBE, or NO for your availability response.' });
    const rehearsalId = String(request.params.rehearsalId);
    const userId = request.userId;
    const [membership, rehearsal] = await Promise.all([
        prisma_1.prisma.membership.findUnique({ where: { userId_choirId: { userId, choirId: String(request.params.choirId) } } }),
        prisma_1.prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId: String(request.params.choirId) }, include: { invitations: { where: { userId }, select: { id: true } } } }),
    ]);
    if (!membership || !rehearsal)
        return response.status(403).json({ message: 'You cannot respond to this event.' });
    if (rehearsal.endsAt.getTime() < Date.now())
        return response.status(410).json({ message: 'This event has ended, so its attendance response is closed.' });
    const invitationCount = await prisma_1.prisma.eventInvitation.count({ where: { rehearsalId } });
    if (invitationCount > 0 && rehearsal.invitations.length === 0)
        return response.status(403).json({ message: 'This event is invitation-only, and you were not invited.' });
    const existingResponse = await prisma_1.prisma.eventResponse.findUnique({
        where: { rehearsalId_userId: { rehearsalId, userId } },
    });
    if (existingResponse) {
        if (existingResponse.status !== status) {
            return response.status(409).json({ message: 'Your availability response is locked and cannot be changed.' });
        }
        return response.json(existingResponse);
    }
    // Create once: availability is an immutable RSVP, separate from actual attendance.
    let eventResponse;
    try {
        eventResponse = await prisma_1.prisma.eventResponse.create({
            data: { rehearsalId, userId, status },
            select: { id: true, rehearsalId: true, userId: true, status: true },
        });
    }
    catch (error) {
        // The unique constraint also protects against two near-simultaneous replies.
        const savedResponse = await prisma_1.prisma.eventResponse.findUnique({
            where: { rehearsalId_userId: { rehearsalId, userId } },
        });
        if (!savedResponse)
            throw error;
        if (savedResponse.status !== status) {
            return response.status(409).json({ message: 'Your availability response is locked and cannot be changed.' });
        }
        eventResponse = savedResponse;
    }
    return response.json(eventResponse);
});
exports.default = router;
