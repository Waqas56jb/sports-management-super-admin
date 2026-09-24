/**
 * Weekly training programme for every team. Descriptions, objectives and notes are stored as keys
 * so the player reads them in their own language (training.plans / objectives / notes in i18n).
 */
import { addDays, toISODate } from '../../../utils/dates.js';

const WEEKLY = [
  { dow: 1, type: 'recovery', start: '07:00', end: '08:30' },
  { dow: 2, type: 'tactical', start: '17:00', end: '19:00' },
  { dow: 4, type: 'technical', start: '17:00', end: '19:00' },
  { dow: 5, type: 'match_preparation', start: '17:30', end: '19:00' },
];

export const OBJECTIVES = {
  fitness: ['intervals', 'sprints', 'hydration'],
  tactical: ['pressing', 'compactness', 'transitions'],
  technical: ['rondos', 'passing', 'finishing'],
  recovery: ['mobility', 'regeneration', 'load'],
  match_preparation: ['setPieces', 'opponent', 'lineupWalkthrough'],
  other: ['teamBuilding'],
};

const NOTES = ['bothKits', 'arriveEarly', 'bringGps', 'waterBottle', null, null];
const CANCEL_REASONS = ['pitchUnavailable', 'heatWarning', 'maintenance'];

export function buildTrainingSessions({ teams, now, stamp }) {
  const sessions = [];
  let seq = 1;
  const startMonday = addDays(now, -((now.getDay() + 6) % 7) - 7 * 6);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let week = 0; week < 9; week += 1) {
    teams.forEach((team, ti) => {
      WEEKLY.forEach((slot, si) => {
        if ((si + ti) % 4 === 3) return; // each team trains three times a week
        const date = addDays(startMonday, week * 7 + slot.dow - 1);
        const offset = Math.round((date - midnight) / 86400000);
        const type = week === 2 && slot.type === 'technical' ? 'fitness' : slot.type;
        const session = {
          id: `ts${seq}`,
          team_id: team.id,
          coach_id: team.coach_id,
          date: toISODate(date),
          start_time: ti === 2 && slot.start === '17:00' ? '16:30' : slot.start,
          end_time: ti === 2 && slot.end === '19:00' ? '18:30' : slot.end,
          location: team.home_ground,
          training_type: type,
          description: '',
          description_key: type,
          objectives: OBJECTIVES[type],
          player_note: NOTES[(seq + ti) % NOTES.length],
          notes: '',
          status: 'scheduled',
          cancellation_reason: '',
          cancellation_key: null,
          created_at: stamp(offset - 6, 11),
        };
        if ((team.id === 't1' && week === 3 && slot.dow === 2) || (team.id === 't1' && week === 7 && slot.dow === 5) || (team.id === 't3' && week === 7 && slot.dow === 4)) {
          session.status = 'cancelled';
          session.cancellation_key = CANCEL_REASONS[week % CANCEL_REASONS.length];
        }
        seq += 1;
        sessions.push(session);
      });
    });
  }
  return sessions;
}
