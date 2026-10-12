"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const shared_1 = require("./shared");
const router = (0, express_1.Router)();
router.put('/:choirId/rehearsals/:rehearsalId/songs', auth_1.requireAdmin, async (request, response) => {
    const { songIds } = request.body ?? {};
    if (!Array.isArray(songIds) || songIds.some((id) => typeof id !== 'string')) {
        return response.status(400).json({ message: 'Choose songs from the ministry library.' });
    }
    const choirId = String(request.params.choirId);
    const rehearsalId = String(request.params.rehearsalId);
    const rehearsal = await prisma_1.prisma.rehearsal.findFirst({ where: { id: rehearsalId, choirId }, select: { id: true } });
    if (!rehearsal)
        return response.status(404).json({ message: 'Event not found in this ministry.' });
    const selectedSongIds = [...new Set(songIds)];
    if (selectedSongIds.length > 0) {
        const choirSongs = await prisma_1.prisma.song.findMany({ where: { choirId, id: { in: selectedSongIds } }, select: { id: true } });
        if (choirSongs.length !== selectedSongIds.length) {
            return response.status(400).json({ message: 'Choose songs from the ministry library.' });
        }
    }
    const eventSongs = await prisma_1.prisma.$transaction(async (transaction) => {
        await transaction.eventSong.deleteMany({ where: { rehearsalId } });
        if (selectedSongIds.length > 0) {
            await transaction.eventSong.createMany({
                data: selectedSongIds.map((songId, sortOrder) => ({ rehearsalId, songId, sortOrder })),
            });
        }
        return transaction.eventSong.findMany({ where: { rehearsalId }, ...shared_1.eventSongInclude });
    });
    return response.json({ songs: (0, shared_1.serializeEventSongs)(eventSongs) });
});
exports.default = router;
