export function buildAttendanceMembers(memberships: any[], rehearsals: any[], canViewAll: boolean) {
  return memberships.map((membership) => {
    const events = rehearsals.flatMap((rehearsal) => {
      const inviteeIds = rehearsal.invitations.map((invitation: any) => invitation.userId);
      if (inviteeIds.length > 0 && !inviteeIds.includes(membership.userId)) return [];
      const status = rehearsal.attendances.find((entry: any) => entry.userId === membership.userId)?.status ?? 'PENDING';
      return [{
        rehearsalId: rehearsal.id, title: rehearsal.title, eventType: rehearsal.eventType,
        customEventType: rehearsal.customEventType, eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
        recurrenceFrequency: rehearsal.recurrenceFrequency, recurrenceIndex: rehearsal.recurrenceIndex,
        recurrenceTotal: rehearsal.recurrenceTotal, startsAt: rehearsal.startsAt.toISOString(),
        location: rehearsal.location, status,
      }];
    });
    const yes = events.filter((event) => event.status === 'YES').length;
    const maybe = events.filter((event) => event.status === 'MAYBE').length;
    const no = events.filter((event) => event.status === 'NO').length;
    const pending = events.filter((event) => event.status === 'PENDING').length;
    const responded = yes + maybe + no;
    return {
      id: membership.user.id, name: membership.user.name,
      email: canViewAll ? membership.user.email : undefined, ministryTeam: membership.ministryTeam,
      stats: { yes, maybe, no, pending, responseRate: events.length ? Math.round((responded / events.length) * 100) : 0 },
      events,
    };
  });
}
