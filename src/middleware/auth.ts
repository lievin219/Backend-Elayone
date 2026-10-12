import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export type AuthRequest = Request & { userId?: string };

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return response.status(401).json({ message: 'Authentication is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    request.userId = payload.userId;
    return next();
  } catch {
    return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export async function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  if (!request.userId) return response.status(401).json({ message: 'Authentication is required.' });
  const choirId = String(request.params.choirId ?? '');
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } }),
    choirId ? prisma.membership.findUnique({ where: { userId_choirId: { userId: request.userId, choirId } }, select: { id: true } }) : null,
  ]);
  if (user?.role !== 'ADMIN' && (user?.role !== 'LEADER' || !membership)) {
    return response.status(403).json({ message: 'Only a ministry administrator or leader can do this.' });
  }
  return next();
}

export async function requireAdministrator(request: AuthRequest, response: Response, next: NextFunction) {
  if (!request.userId) return response.status(401).json({ message: 'Authentication is required.' });
  const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') return response.status(403).json({ message: 'Only an administrator can manage user accounts.' });
  return next();
}

export async function requireChoirAccess(request: AuthRequest, response: Response, next: NextFunction) {
  if (!request.userId) return response.status(401).json({ message: 'Authentication is required.' });
  const choirId = String(request.params.choirId);
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.userId }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_choirId: { userId: request.userId, choirId } }, select: { id: true } }),
  ]);
  if (user?.role === 'ADMIN' || membership) return next();
  return response.status(403).json({ message: 'You must be part of this ministry to view this information.' });
}
