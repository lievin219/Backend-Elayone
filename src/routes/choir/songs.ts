import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import {
  getSongMediaPath,
  removeSongMedia,
  SongMediaConfigurationError,
  uploadSongMedia,
} from '../../lib/song-media';
import { requireAdmin, requireChoirAccess } from '../../middleware/auth';
import { uploadMedia } from './media-upload';

const router = Router();

router.get('/:choirId/songs', requireChoirAccess, async (request, response) => {
  return response.json(await prisma.song.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { title: 'asc' } }));
});

router.post('/:choirId/songs', requireAdmin, uploadMedia, async (request, response) => {
  const { title, key, status, notes, previewUrl } = request.body ?? {};
  if (typeof title !== 'string' || !title.trim()) {
    return response.status(400).json({ message: 'Song title is required.' });
  }
  if (request.file && !['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(request.file.mimetype)) return response.status(400).json({ message: 'Only MP3 and MP4 files are supported.' });
  const externalPreviewUrl = typeof previewUrl === 'string' && previewUrl.trim() ? previewUrl.trim() : null;
  let media = null;
  if (request.file) {
    try {
      media = await uploadSongMedia(request.file);
    } catch (error) {
      if (error instanceof SongMediaConfigurationError) {
        return response.status(503).json({ message: error.message });
      }
      throw error;
    }
  }
  let song;
  try {
    song = await prisma.song.create({
      data: {
        choirId: String(request.params.choirId),
        title: String(title).trim(),
        key: key ? String(key).trim() : null,
        status: status === 'READY' || status === 'LEARN' ? status : 'LEARN',
        notes: notes ? String(notes).trim() : null,
        previewUrl: media?.publicUrl ?? externalPreviewUrl,
      },
    });
  } catch (error) {
    if (media) {
      try {
        await removeSongMedia(media.path);
      } catch (cleanupError) {
        console.error('[songs] Failed to clean up uploaded media after database write failed:', cleanupError);
      }
    }
    throw error;
  }
  return response.status(201).json(song);
});

router.delete('/:choirId/songs/:songId', requireAdmin, async (request, response) => {
  const song = await prisma.song.findFirst({ where: { id: String(request.params.songId), choirId: String(request.params.choirId) } });
  if (!song) return response.status(404).json({ message: 'Song not found.' });
  await prisma.song.delete({ where: { id: song.id } });
  const mediaPath = song.previewUrl ? getSongMediaPath(song.previewUrl) : null;
  if (mediaPath) {
    try {
      await removeSongMedia(mediaPath);
    } catch (error) {
      console.error(`[songs] Song ${song.id} was deleted, but its storage object could not be removed:`, error);
      return response.status(500).json({ message: 'The song was deleted, but its media could not be removed from Supabase Storage.' });
    }
  }
  return response.status(204).send();
});


export default router;
