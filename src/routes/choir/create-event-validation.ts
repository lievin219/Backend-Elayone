import { prisma } from '../../lib/prisma';
import { EventType } from '@prisma/client';

export type ValidatedEventInput = {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  normalizedType: EventType;
  normalizedCustomType: string | null;
  normalizedFrequency: string;
  count: number;
  selectedInviteeIds: string[];
  selectedSongIds: string[];
};

export function validateCreateEventInput(body: Record<string, any>): ValidatedEventInput | { error: string } {
  const { title, startsAt, endsAt, location, eventType, customEventType, recurrenceFrequency, recurrenceCount, inviteeIds, songIds } = body;
  if (typeof title !== 'string' || !title.trim() || typeof startsAt !== 'string' || typeof endsAt !== 'string' || typeof location !== 'string' || !location.trim()) return { error: 'Title, dates, and location are required.' };
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return { error: 'Enter a valid event start and end time; the end must be after the start.' };
  if (inviteeIds !== undefined && (!Array.isArray(inviteeIds) || inviteeIds.length === 0 || inviteeIds.some((id) => typeof id !== 'string'))) return { error: 'Choose at least one person to invite, or leave the list empty to invite everyone.' };
  if (songIds !== undefined && (!Array.isArray(songIds) || songIds.some((id) => typeof id !== 'string'))) return { error: 'Choose songs from the ministry library, or leave the list empty to create the event without songs.' };
  if (eventType !== undefined && !['SERVICE', 'REHEARSAL', 'WORSHIP_NIGHT', 'SPECIAL_EVENT', 'CUSTOM'].includes(eventType)) return { error: 'Choose a valid event type.' };
  if (eventType === 'CUSTOM' && (typeof customEventType !== 'string' || !customEventType.trim() || customEventType.trim().length > 80)) return { error: 'Enter a name for the custom event type.' };
  const frequencies = ['NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'];
  if (recurrenceFrequency !== undefined && !frequencies.includes(recurrenceFrequency)) return { error: 'Choose a valid recurrence frequency.' };
  const normalizedFrequency = recurrenceFrequency ?? 'NONE';
  const count = recurrenceCount === undefined ? 1 : Number(recurrenceCount);
  if (!Number.isInteger(count) || count < 1 || count > 52) return { error: 'Recurring events must have between 1 and 52 occurrences.' };
  if (normalizedFrequency === 'NONE' && count !== 1) return { error: 'Choose a recurrence frequency for multiple event occurrences.' };
  return {
    title, startDate, endDate, location,
    normalizedType: eventType && eventType !== 'CUSTOM' ? eventType : 'REHEARSAL',
    normalizedCustomType: eventType === 'CUSTOM' ? customEventType.trim() : null,
    normalizedFrequency, count,
    selectedInviteeIds: inviteeIds === undefined ? [] : [...new Set(inviteeIds as string[])],
    selectedSongIds: songIds === undefined ? [] : [...new Set(songIds as string[])],
  };
}

export async function validateEventReferences(choirId: string, input: ValidatedEventInput) {
  if (input.selectedInviteeIds.length > 0) {
    const memberships = await prisma.membership.findMany({ where: { choirId, userId: { in: input.selectedInviteeIds } }, select: { userId: true } });
    if (memberships.length !== input.selectedInviteeIds.length) return 'Everyone you invite must be part of this ministry.';
  }
  if (input.selectedSongIds.length > 0) {
    const choirSongs = await prisma.song.findMany({ where: { choirId, id: { in: input.selectedSongIds } }, select: { id: true } });
    if (choirSongs.length !== input.selectedSongIds.length) return 'Choose songs from the ministry library.';
  }
  return null;
}
