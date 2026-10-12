"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireAdministrator = requireAdministrator;
exports.requireChoirAccess = requireChoirAccess;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
function requireAuth(request, response, next) {
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token)
        return response.status(401).json({ message: 'Authentication is required.' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        request.userId = payload.userId;
        return next();
    }
    catch {
        return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
}
async function requireAdmin(request, response, next) {
    if (!request.userId)
        return response.status(401).json({ message: 'Authentication is required.' });
    const choirId = String(request.params.choirId ?? '');
    const [user, membership] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } }),
        choirId ? prisma_1.prisma.membership.findUnique({ where: { userId_choirId: { userId: request.userId, choirId } }, select: { id: true } }) : null,
    ]);
    if (user?.role !== 'ADMIN' && (user?.role !== 'LEADER' || !membership)) {
        return response.status(403).json({ message: 'Only a ministry administrator or leader can do this.' });
    }
    return next();
}
async function requireAdministrator(request, response, next) {
    if (!request.userId)
        return response.status(401).json({ message: 'Authentication is required.' });
    const user = await prisma_1.prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } });
    if (user?.role !== 'ADMIN')
        return response.status(403).json({ message: 'Only an administrator can manage user accounts.' });
    return next();
}
async function requireChoirAccess(request, response, next) {
    if (!request.userId)
        return response.status(401).json({ message: 'Authentication is required.' });
    const choirId = String(request.params.choirId);
    const [user, membership] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } }),
        prisma_1.prisma.membership.findUnique({ where: { userId_choirId: { userId: request.userId, choirId } }, select: { id: true } }),
    ]);
    if (user?.role === 'ADMIN' || membership)
        return next();
    return response.status(403).json({ message: 'You must be part of this ministry to view this information.' });
}
