import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthRequest, requireAdmin, requireChoirAccess } from '../../middleware/auth';

const router = Router();

router.get('/:choirId/announcements', requireChoirAccess, async (request, response) => {
  return response.json(await prisma.announcement.findMany({
    where: { choirId: String(request.params.choirId) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  }));
});


router.post('/:choirId/announcements', requireAdmin, async (request: AuthRequest, response) => {
  const { title, message, priority } = request.body ?? {};
  if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
    return response.status(400).json({ message: 'Title and message are required.' });
  }
  if (priority !== undefined && !['NORMAL', 'IMPORTANT'].includes(priority)) {
    return response.status(400).json({ message: 'Choose NORMAL or IMPORTANT announcement priority.' });
  }
  const announcement = await prisma.announcement.create({
    data: {
      choirId: String(request.params.choirId),
      title: title.trim(),
      message: message.trim(),
      priority: priority === 'IMPORTANT' ? 'IMPORTANT' : 'NORMAL',
      authorId: request.userId,
    },
    include: { author: { select: { name: true } } },
  });
  return response.status(201).json(announcement);
});

router.delete('/:choirId/announcements/:announcementId', requireAdmin, async (request, response) => {
  const deleted = await prisma.announcement.deleteMany({
    where: { id: String(request.params.announcementId), choirId: String(request.params.choirId) },
  });
  if (deleted.count === 0) return response.status(404).json({ message: 'Announcement not found.' });
  return response.status(204).send();
});


export default router;
