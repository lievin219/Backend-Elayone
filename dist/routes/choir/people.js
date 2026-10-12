"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/me', async (request, response) => {
    const memberships = await prisma_1.prisma.membership.findMany({ where: { userId: request.userId }, include: { choir: true } });
    return response.json(memberships);
});
router.get('/:choirId/people', auth_1.requireChoirAccess, async (request, response) => {
    const members = await prisma_1.prisma.membership.findMany({ where: { choirId: String(request.params.choirId) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { user: { name: 'asc' } } });
    return response.json(members);
});
router.delete('/:choirId/people/:userId', auth_1.requireAdmin, async (request, response) => {
    await prisma_1.prisma.membership.delete({ where: { userId_choirId: { userId: String(request.params.userId), choirId: String(request.params.choirId) } } });
    return response.status(204).send();
});
exports.default = router;
