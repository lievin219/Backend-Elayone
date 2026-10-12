export function buildAttendanceEvents(members: any[], rehearsals: any[]) {
  const total = members.reduce((count, member) => count + member.events.length, 0);
  const summary = members.reduce((counts, member) => ({
    yes: counts.yes + member.stats.yes,
    maybe: counts.maybe + member.stats.maybe,
    no: counts.no + member.stats.no,
    pending: counts.pending + member.stats.pending,
  }), { yes: 0, maybe: 0, no: 0, pending: 0 });
  const responded = summary.yes + summary.maybe + summary.no;
  const events = rehearsals.map((rehearsal) => {
    const responses = members.flatMap((member) => {
      const memberEvent = member.events.find((event: any) => event.rehearsalId === rehearsal.id);
      return memberEvent ? [{ userId: member.id, name: member.name, status: memberEvent.status }] : [];
    });
    return {
      id: rehearsal.id, title: rehearsal.title, eventType: rehearsal.eventType,
      customEventType: rehearsal.customEventType, eventTypeName: rehearsal.customEventType ?? rehearsal.eventType,
      recurrenceFrequency: rehearsal.recurrenceFrequency, recurrenceIndex: rehearsal.recurrenceIndex,
      recurrenceTotal: rehearsal.recurrenceTotal, startsAt: rehearsal.startsAt.toISOString(),
      location: rehearsal.location,
      totals: {
        yes: responses.filter((entry) => entry.status === 'YES').length,
        maybe: responses.filter((entry) => entry.status === 'MAYBE').length,
        no: responses.filter((entry) => entry.status === 'NO').length,
        pending: responses.filter((entry) => entry.status === 'PENDING').length,
      },
      responses,
    };
  });
  return { total, summary, responded, events };
}
