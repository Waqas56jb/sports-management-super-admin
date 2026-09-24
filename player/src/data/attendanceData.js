/** Attendance registers for past sessions. Each player has a stable reliability so rates look realistic. */
import { ABSENCE_NOTES } from './names';

export function buildAttendance({ rng, players, sessions, today }) {
  const attendance = [];
  let seq = 1;
  const reliability = Object.fromEntries(players.map((p) => [p.id, 0.72 + rng.next() * 0.25]));
  reliability.p14 = 0.9; // the demo player — reliable but not perfect

  sessions
    .filter((s) => s.date < today && s.status !== 'cancelled')
    .forEach((session) => {
      players
        .filter((p) => p.team_id === session.team_id && p.status !== 'inactive')
        .forEach((p) => {
          const r = rng.next();
          const rel = reliability[p.id];
          let status = 'present';
          if (r > rel + 0.18) status = 'absent';
          else if (r > rel + 0.1) status = 'excused';
          else if (r > rel) status = 'late';
          attendance.push({
            id: `a${seq}`,
            training_session_id: session.id,
            player_id: p.id,
            status,
            notes: status === 'present' ? '' : rng.pick(ABSENCE_NOTES[status]),
          });
          seq += 1;
        });
    });

  // The most recent Djibouti FC session is still waiting for the coach's register → "Pending" for players.
  const pending = sessions
    .filter((s) => s.team_id === 't1' && s.date < today && s.status !== 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return pending ? attendance.filter((a) => a.training_session_id !== pending.id) : attendance;
}
