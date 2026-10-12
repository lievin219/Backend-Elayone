import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireChoirAccess } from '../../middleware/auth';

const router = Router();

router.get('/:choirId/attendance/summary', requireChoirAccess, async (request: AuthRequest, response) => {
  const userId = request.userId as string;
  const choirId = String(request.params.choirId);
  const [total, confirmed, upcoming] = await Promise.all([
    prisma.attendance.count({ where: { userId, rehearsal: { choirId } } }),
    prisma.attendance.count({ where: { userId, rehearsal: { choirId }, status: 'YES' } }),
    prisma.rehearsal.count({
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


export default router;
