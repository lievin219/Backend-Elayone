"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventSongInclude = void 0;
exports.serializeEventSongs = serializeEventSongs;
exports.getOccurrenceDates = getOccurrenceDates;
function serializeEventSongs(eventSongs) {
    return eventSongs.map((entry) => ({
        id: entry.song.id,
        title: entry.song.title,
        key: entry.song.key,
        status: entry.song.status,
        sortOrder: entry.sortOrder,
    }));
}
exports.eventSongInclude = { orderBy: { sortOrder: 'asc' }, include: { song: { select: { id: true, title: true, key: true, status: true } } } };
function getOccurrenceDates(start, end, index, frequency) {
    const occurrenceStart = new Date(start);
    if (frequency === 'WEEKLY')
        occurrenceStart.setUTCDate(occurrenceStart.getUTCDate() + index * 7);
    if (frequency === 'BIWEEKLY')
        occurrenceStart.setUTCDate(occurrenceStart.getUTCDate() + index * 14);
    if (frequency === 'MONTHLY') {
        const targetMonth = start.getUTCMonth() + index;
        const year = start.getUTCFullYear() + Math.floor(targetMonth / 12);
        const month = targetMonth % 12;
        const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
        occurrenceStart.setUTCDate(1);
        occurrenceStart.setUTCFullYear(year, month, day);
    }
    return { startsAt: occurrenceStart, endsAt: new Date(occurrenceStart.getTime() + end.getTime() - start.getTime()) };
}
