"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const song_media_1 = require("../../lib/song-media");
const auth_1 = require("../../middleware/auth");
const media_upload_1 = require("./media-upload");
const router = (0, express_1.Router)();
router.post('/:choirId/songs/upload-url', auth_1.requireAdmin, async (request, response) => {
    const { mimeType, fileName, fileSize } = request.body ?? {};
    if (!['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(mimeType)) {
        return response.status(400).json({ message: 'Only MP3 and MP4 media files are supported.' });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 100 * 1024 * 1024) {
        return response.status(413).json({ message: 'The media file must be between 1 byte and 100 MB.' });
    }
    try {
        const upload = await (0, song_media_1.createSongUpload)(String(mimeType), String(fileName ?? 'song'));
        return response.status(201).json(upload);
    }
    catch (error) {
        if (error instanceof song_media_1.SongMediaConfigurationError) {
            return response.status(503).json({ message: error.message });
        }
        return response.status(400).json({ message: error instanceof Error ? error.message : 'Could not prepare the song upload.' });
    }
});
router.get('/:choirId/songs', auth_1.requireChoirAccess, async (request, response) => {
    const songs = await prisma_1.prisma.song.findMany({ where: { choirId: String(request.params.choirId) }, orderBy: { title: 'asc' } });
    const songsWithPlaybackUrls = await Promise.all(songs.map(async (song) => ({
        ...song,
        previewUrl: await (0, song_media_1.getPlayableSongUrl)(song.previewUrl),
    })));
    return response.json(songsWithPlaybackUrls);
});
router.post('/:choirId/songs', auth_1.requireAdmin, media_upload_1.uploadMedia, async (request, response) => {
    const { title, key, status, notes, previewUrl } = request.body ?? {};
    if (typeof title !== 'string' || !title.trim()) {
        return response.status(400).json({ message: 'Song title is required.' });
    }
    if (request.file && !['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/mp4'].includes(request.file.mimetype))
        return response.status(400).json({ message: 'Only MP3 and MP4 files are supported.' });
    const externalPreviewUrl = typeof previewUrl === 'string' && previewUrl.trim() ? previewUrl.trim() : null;
    if (externalPreviewUrl) {
        try {
            const preview = new URL(externalPreviewUrl);
            if (preview.protocol !== 'https:' && preview.protocol !== 'http:') {
                return response.status(400).json({ message: 'The preview URL must use HTTP or HTTPS.' });
            }
        }
        catch {
            return response.status(400).json({ message: 'Enter a valid preview URL.' });
        }
    }
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
                previewUrl: media?.publicUrl ?? externalPreviewUrl,
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
    return response.status(201).json({
        ...song,
        previewUrl: await (0, song_media_1.getPlayableSongUrl)(song.previewUrl),
    });
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
