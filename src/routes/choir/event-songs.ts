import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAdmin } from '../../middleware/auth';
import { eventSongInclude, serializeEventSongs } from './shared';

const router = Router();

router.put('/:choirId/rehearsals/:rehearsalId/songs', requireAdmin, async (request, response) => {
  const { songIds } = request.body ?? {};
  if (!Array.isArray(songIds) || songIds.some((id) => typeof id !== 'string')) {
    return response.status(400).json({ message: 'Choose songs from the ministry library.' });
  }

  const choirId = String(request.params.choirId);
  const rehearsalId = String(request.params.rehearsalId);
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId }, select: { id: true } });
  if (!rehearsal) return response.status(404).json({ message: 'Event not found in this ministry.' });

  const selectedSongIds = [...new Set(songIds as string[])];
  if (selectedSongIds.length > 0) {
    const choirSongs = await prisma.song.findMany({ where: { choirId, id: { in: selectedSongIds } }, select: { id: true } });
    if (choirSongs.length !== selectedSongIds.length) {
      return response.status(400).json({ message: 'Choose songs from the ministry library.' });
    }
  }

  const eventSongs = await prisma.$transaction(async (transaction) => {
    await transaction.eventSong.deleteMany({ where: { rehearsalId } });
    if (selectedSongIds.length > 0) {
      await transaction.eventSong.createMany({
        data: selectedSongIds.map((songId, sortOrder) => ({ rehearsalId, songId, sortOrder })),
      });
    }
    return transaction.eventSong.findMany({ where: { rehearsalId }, ...eventSongInclude });
  });

  return response.json({ songs: serializeEventSongs(eventSongs) });
});


export default router;
