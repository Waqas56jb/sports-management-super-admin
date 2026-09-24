/**
 * Notifications for the demo player. Stored as template + params so they render in the viewer's
 * language (notifications.templates.* in i18n).
 */
export function buildNotifications({ userId, matches, sessions, competitions, day, pastStamp, now, teamName }) {
  const mine = (m) => m.home_team_id === 't1' || m.away_team_id === 't1';
  const live = matches.find((m) => m.status === 'live' && mine(m));
  const next = matches.filter((m) => m.status === 'scheduled' && mine(m)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const last = matches.filter((m) => m.status === 'completed' && mine(m)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const nextTraining = sessions.filter((s) => s.team_id === 't1' && s.status !== 'cancelled' && s.date >= day(0)).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))[0];
  const cancelled = sessions.find((s) => s.team_id === 't1' && s.status === 'cancelled' && s.date >= day(0));
  const cup = competitions.find((c) => c.id === 'k2');

  const N = (type, template, params, offset, hour, minute, isRead, link) => ({ type, template, params, link, is_read: isRead, created_at: pastStamp(offset, hour, minute) });
  const list = [
    live && N('match_reminder', 'match_live', { home: teamName(live.home_team_id), away: teamName(live.away_team_id) }, 0, now.getHours(), Math.max(0, now.getMinutes() - 6), false, `/player/matches/${live.id}`),
    nextTraining && N('training_reminder', 'training_reminder', { date: nextTraining.date, time: nextTraining.start_time }, 0, 7, 45, false, `/player/training/${nextTraining.id}`),
    next[0] && N('match_reminder', 'match_upcoming', { home: teamName(next[0].home_team_id), away: teamName(next[0].away_team_id), date: next[0].date, time: next[0].time }, -1, 18, 0, false, `/player/matches/${next[0].id}`),
    N('team_announcement', 'lineup_published', { home: 'Young Stars FC', away: 'Djibouti FC' }, 0, Math.max(0, now.getHours() - 2), 5, false, live ? `/player/matches/${live.id}?tab=lineup` : '/player/matches'),
    last && N('match_result', 'match_result', { home: teamName(last.home_team_id), away: teamName(last.away_team_id), score: `${last.home_score}–${last.away_score}` }, -7, 18, 55, true, `/player/matches/${last.id}`),
    N('attendance_update', 'attendance_updated', {}, -2, 20, 10, true, '/player/attendance'),
    cancelled && N('training_reminder', 'training_cancelled', { date: cancelled.date }, -3, 9, 5, true, `/player/training/${cancelled.id}`),
    N('team_announcement', 'team_meeting', { date: day(1), time: '19:30' }, -1, 12, 30, true, '/player/calendar'),
    cup && N('competition_update', 'competition_schedule', { name: cup.name, season: cup.season }, -9, 16, 0, true, `/player/competitions/${cup.id}`),
    N('team_announcement', 'heat_protocol', {}, -12, 10, 0, true, null),
    N('system', 'system_maintenance', { date: day(4) }, -14, 8, 0, true, null),
    N('system', 'welcome', {}, -40, 9, 0, true, '/player/profile'),
  ].filter(Boolean);
  return list.map((n, i) => ({ id: `n${i + 1}`, user_id: userId, title: null, message: null, ...n }));
}
