import { prisma } from '../../lib/prisma';
import { eventSongInclude, getOccurrenceDates } from './shared';
import { ValidatedEventInput } from './create-event-validation';

export async function createRecurringEvent(choirId: string, input: ValidatedEventInput) {
  return prisma.$transaction(async (transaction) => {
    let firstCreated: typeof prisma.rehearsal extends never ? never : Awaited<ReturnType<typeof transaction.rehearsal.create>> | null = null;
    for (let index = 0; index < input.count; index += 1) {
      const { startsAt: startsAtDate, endsAt: endsAtDate } = getOccurrenceDates(input.startDate, input.endDate, index, input.normalizedFrequency);
      const created = await transaction.rehearsal.create({ data: { choirId, title: input.title.trim(), eventType: input.normalizedType, customEventType: input.normalizedCustomType, recurrenceFrequency: input.normalizedFrequency, recurrenceIndex: index + 1, recurrenceTotal: input.count, startsAt: startsAtDate, endsAt: endsAtDate, location: input.location.trim() } });
      if (!firstCreated) firstCreated = created;
      if (input.selectedInviteeIds.length > 0) {
        await transaction.eventInvitation.createMany({ data: input.selectedInviteeIds.map((userId) => ({ rehearsalId: created.id, userId })) });
      }
      if (input.selectedSongIds.length > 0) {
        await transaction.eventSong.createMany({ data: input.selectedSongIds.map((songId, songIndex) => ({ rehearsalId: created.id, songId, sortOrder: songIndex })) });
      }
    }
    if (!firstCreated) throw new Error('Could not create event.');
    return {
      ...firstCreated,
      invitations: await transaction.eventInvitation.findMany({ where: { rehearsalId: firstCreated.id }, include: { user: { select: { id: true, name: true } } } }),
      eventSongs: await transaction.eventSong.findMany({ where: { rehearsalId: firstCreated.id }, ...eventSongInclude }),
    };
  });
}
