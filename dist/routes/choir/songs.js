"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const song_media_1 = require("../../lib/song-media");
const auth_1 = require("../../middleware/auth");
const media_upload_1 = require("./media-upload");
const router = (0, express_1.Router)();
router.get('/:choirId/songs', auth_1.requireChoirAccess, async (request, response) => {
    return response.json(await prisma_1.prisma.song.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { title: 'asc' } }));
});
router.post('/:choirId/songs', auth_1.requireAdmin, media_upload_1.uploadMedia, async (request, response) => {
    const { title, key, status, notes, previewUrl } = request.body ?? {};
    if (typeof title !== 'string' || !title.trim()) {
        return response.status(400).json({ message: 'Song title is required.' });
    }
    if (!request.file && (typeof previewUrl !== 'string' || !previewUrl.trim()))
        return response.status(400).json({ message: 'Attach an MP3 or MP4 file, or provide a preview URL.' });
    if (request.file && !['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(request.file.mimetype))
        return response.status(400).json({ message: 'Only MP3 and MP4 files are supported.' });
    let media = null;
    if (request.file) {
        try {
            media = await (0, song_media_1.uploadSongMedia)(request.file);
        }
        catch (error) {
            if (error instanceof song_media_1.SongMediaConfigurationError) {
                return response.status(503).json({ message: error.message });
            }
            throw error;
        }
    }
    let song;
    try {
        song = await prisma_1.prisma.song.create({
            data: {
                choirId: String(request.params.choirId),
                title: String(title).trim(),
                key: key ? String(key).trim() : null,
                status: status === 'READY' || status === 'LEARN' ? status : 'LEARN',
                notes: notes ? String(notes).trim() : null,
                previewUrl: media?.publicUrl ?? (previewUrl ? String(previewUrl).trim() : null),
            },
        });
    }
    catch (error) {
        if (media) {
            try {
                await (0, song_media_1.removeSongMedia)(media.path);
            }
            catch (cleanupError) {
                console.error('[songs] Failed to clean up uploaded media after database write failed:', cleanupError);
            }
        }
        throw error;
    }
    return response.status(201).json(song);
});
router.delete('/:choirId/songs/:songId', auth_1.requireAdmin, async (request, response) => {
    const song = await prisma_1.prisma.song.findFirst({ where: { id: String(request.params.songId), choirId: String(request.params.choirId) } });
    if (!song)
        return response.status(404).json({ message: 'Song not found.' });
    await prisma_1.prisma.song.delete({ where: { id: song.id } });
    const mediaPath = song.previewUrl ? (0, song_media_1.getSongMediaPath)(song.previewUrl) : null;
    if (mediaPath) {
        try {
            await (0, song_media_1.removeSongMedia)(mediaPath);
        }
        catch (error) {
            console.error(`[songs] Song ${song.id} was deleted, but its storage object could not be removed:`, error);
            return response.status(500).json({ message: 'The song was deleted, but its media could not be removed from Supabase Storage.' });
        }
    }
    return response.status(204).send();
});
exports.default = router;
