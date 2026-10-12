import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireChoirAccess } from '../../middleware/auth';
import { buildEventReminders } from './reminder-serialization';

const router = Router();

router.get('/:choirId/reminders', requireChoirAccess, async (request: AuthRequest, response) => {
  const choirId = String(request.params.choirId);
  const userId = request.userId as string;
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const canManage = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const events = await prisma.rehearsal.findMany({
    where: { choirId, startsAt: { gte: now, lte: horizon } },
    include: {
      attendances: { select: { userId: true, status: true } },
      invitations: { select: { userId: true } },
    },
    orderBy: { startsAt: 'asc' },
  });
  return response.json(buildEventReminders(events, userId, canManage, now));
});


export default router;
