/**
 * English text for notification templates, per recipient app. The apps translate `template` +
 * `params` themselves (EN/FR); the stored title/message is the readable fallback for any client
 * (emails, logs, other consumers). Only templates that exist in the recipient's app are used.
 */
import { formatLongDate } from './dates.js';

export const TEMPLATES = {
  admin: {
    match_live: ['Match in progress', '{home} vs {away} has kicked off. Follow the live score in the match centre.'],
    lineup_announced: ['Line-up announced', '{team} published its line-up for {home} vs {away}.'],
    match_scheduled: ['Match scheduled', '{home} vs {away} has been scheduled for {date}.'],
    match_cancelled: ['Match cancelled', 'The friendly between {home} and {away} was cancelled.'],
    match_result: ['Full time', 'Final score: {home} {score} {away}. Player statistics have been updated.'],
    training_created: ['New training session', '{team} has a new training session on {date}.'],
    player_registered: ['New player registered', '{name} has been registered with {team}.'],
    player_suspended: ['Player suspended', '{name} is suspended and unavailable for selection.'],
    password_reset: ['Password reset', 'A password reset was requested for {name}.'],
    competition_created: ['Competition created', '{name} {season} has been created. Add fixtures to get started.'],
    attendance_low: ['Low training attendance', '{team} attendance dropped to {rate}% last week.'],
    coach_assigned: ['Coach assigned', '{name} is now the head coach of {team}.'],
  },
  coach: {
    match_live: ['Match in progress', '{home} vs {away} has kicked off. Record events live from the match centre.'],
    training_reminder: ['Training today', '{team} trains on {date} at {time}. Remember to take the register.'],
    attendance_pending: ['Register not completed', 'Attendance for the {team} session on {date} has not been recorded yet.'],
    match_scheduled: ['New fixture', '{home} vs {away} has been scheduled for {date}. Prepare your line-up.'],
    training_cancelled: ['Session cancelled', 'The {team} session on {date} has been cancelled.'],
    player_suspended: ['Player suspended', '{name} ({team}) is suspended and cannot be selected.'],
    match_result: ['Full time', 'Final score: {home} {score} {away}. Player statistics have been updated.'],
    competition_fixtures: ['Competition fixtures published', 'The draw for {name} {season} is out. Check your fixtures.'],
    attendance_low: ['Attendance dropping', '{team} attendance fell to {rate}% last week.'],
    announcement_heat: ['Heat protocol', 'From this week all outdoor sessions before 17:00 must include a hydration break every 15 minutes.'],
    system_maintenance: ['Scheduled maintenance', 'The platform will be unavailable for 30 minutes on {date} from 02:00.'],
  },
  player: {
    match_live: ['Your match is live', '{home} vs {away} has kicked off. Follow it in the match centre.'],
    training_reminder: ['Training reminder', 'Training on {date} at {time}. Don’t forget your kit.'],
    match_upcoming: ['Match coming up', '{home} vs {away} on {date} at {time}.'],
    lineup_published: ['Line-up published', 'Your coach has published the line-up for {home} vs {away}.'],
    match_result: ['Match result available', 'Full time: {home} {score} {away}. Your statistics have been updated.'],
    attendance_updated: ['Attendance updated', 'Your coach has updated the attendance register. Check your attendance record.'],
    training_cancelled: ['Training cancelled', 'The session on {date} has been cancelled.'],
    team_meeting: ['Team meeting', 'Team meeting on {date} at {time} at the clubhouse.'],
    competition_schedule: ['Competition schedule updated', 'The fixtures for {name} {season} have been published.'],
    heat_protocol: ['Coach announcement', 'Heat protocol: a hydration break every 15 minutes during outdoor sessions before 17:00.'],
    system_maintenance: ['Scheduled maintenance', 'The platform will be unavailable for 30 minutes on {date} from 02:00.'],
    welcome: ['Welcome to your player space', 'Complete your profile and check your emergency contact.'],
  },
};

export const hasTemplate = (role, template) => Boolean(template && TEMPLATES[role]?.[template]);

function fill(text, params = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined || v === null) return '';
    if (k === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return formatLongDate(v);
    return String(v);
  });
}

/** English title/message for a template (or null when the template is unknown for the role). */
export function renderTemplate(role, template, params) {
  const t = TEMPLATES[role]?.[template];
  if (!t) return null;
  return { title: fill(t[0], params), message: fill(t[1], params) };
}

/**
 * Deep link inside the recipient's app for a notification reference.
 * Stored generically (reference_type + reference_id) so the same event links correctly in every app.
 */
export function linkFor(role, referenceType, referenceId, linkQuery) {
  if (!referenceType) return null;
  const base = `/${role}`;
  const q = linkQuery ? (linkQuery.startsWith('?') ? linkQuery : `?${linkQuery}`) : '';
  const byType = {
    match: `${base}/matches/${referenceId}`,
    match_lineup: role === 'player' ? `${base}/matches/${referenceId}?tab=lineup` : `${base}/matches/${referenceId}`,
    training: `${base}/training/${referenceId}`,
    competition: `${base}/competitions/${referenceId}`,
    calendar: `${base}/calendar`,
    profile: `${base}/profile`,
    attendance: role === 'coach' && referenceId ? `${base}/attendance?team=${referenceId}` : `${base}/attendance`,
    users: role === 'admin' ? `${base}/users` : null,
    coach: role === 'admin' ? `${base}/coaches/${referenceId}` : null,
    player: role === 'player' ? `${base}/team` : `${base}/players/${referenceId}`,
    team: role === 'player' ? `${base}/team` : `${base}/teams/${referenceId}`,
  };
  const path = byType[referenceType] ?? null;
  if (!path) return null;
  return q && !path.includes('?') ? `${path}${q}` : path;
}
