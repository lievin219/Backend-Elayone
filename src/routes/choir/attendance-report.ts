import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireChoirAccess } from '../../middleware/auth';
import { buildAttendanceEvents } from './attendance-report-events';
import { buildAttendanceMembers } from './attendance-report-members';

const router = Router();

router.get('/:choirId/attendance/report', requireChoirAccess, async (request: AuthRequest, response) => {
  const choirId = String(request.params.choirId);
  const userId = request.userId as string;
  const [viewer, choir] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.choir.findUnique({ where: { id: choirId }, select: { id: true } }),
  ]);
  if (!choir) return response.status(404).json({ message: 'Ministry not found.' });
  const canViewAll = viewer?.role === 'ADMIN' || viewer?.role === 'LEADER';
  const memberships = await prisma.membership.findMany({
    where: { choirId, ...(canViewAll ? {} : { userId }) },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  if (!canViewAll && memberships.length === 0) return response.status(403).json({ message: 'You must be part of this ministry to view attendance.' });
  const rehearsals = await prisma.rehearsal.findMany({
    where: { choirId },
    include: { attendances: { select: { userId: true, status: true } }, invitations: { select: { userId: true } } },
    orderBy: { startsAt: 'desc' },
  });
  const members = buildAttendanceMembers(memberships, rehearsals, canViewAll);
  const report = buildAttendanceEvents(members, rehearsals);
  return response.json({
    scope: canViewAll ? 'choir' : 'member',
    generatedAt: new Date().toISOString(),
    summary: { members: members.length, rehearsals: rehearsals.length, total: report.total, ...report.summary, responseRate: report.total ? Math.round((report.responded / report.total) * 100) : 0 },
    events: report.events,
    members,
  });
});

export default router;
