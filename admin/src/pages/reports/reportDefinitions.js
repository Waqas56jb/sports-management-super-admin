import { ClipboardCheck, FileSpreadsheet, Goal, Shield, Shirt, Trophy } from 'lucide-react';
import { ageFrom, formatDate, formatNumber, formatPercent, formatTime } from '@/utils/format';

/**
 * Column definitions per report. `value(row)` returns display text used for the preview table,
 * the CSV file and the PDF — so all three always match and follow the selected language.
 */
export function reportDefinitions(t, lang) {
  const c = (key) => t(`reports.columns.${key}`);
  const pct = (v) => (v == null ? '—' : formatPercent(v, lang));
  const num = (v) => formatNumber(v ?? 0, lang);
  return {
    players: {
      icon: Shirt,
      filters: ['team', 'competition', 'season', 'to'],
      columns: [
        { label: c('player'), value: (r) => r.name },
        { label: c('jersey'), value: (r) => r.jersey_number ?? '' },
        { label: c('team'), value: (r) => r.team?.name ?? '—' },
        { label: c('position'), value: (r) => t(`positions.${r.position}`) },
        { label: c('age'), value: (r) => ageFrom(r.date_of_birth) ?? '' },
        { label: c('status'), value: (r) => t(`status.${r.status}`) },
        { label: c('registered'), value: (r) => formatDate(r.registration_date, lang) },
        { label: c('matches'), value: (r) => r.statistics?.matches_played ?? 0 },
        { label: c('goals'), value: (r) => r.statistics?.goals ?? 0 },
        { label: c('assists'), value: (r) => r.statistics?.assists ?? 0 },
      ],
    },
    teams: {
      icon: Shield,
      filters: ['team', 'competition', 'season', 'from', 'to'],
      columns: [
        { label: c('team'), value: (r) => r.name },
        { label: c('category'), value: (r) => `${t(`categories.${r.category}`)} · ${t(`ageGroups.${r.age_group}`)}` },
        { label: c('coach'), value: (r) => r.coach ?? '—' },
        { label: c('players'), value: (r) => r.players_count },
        { label: c('matches'), value: (r) => r.record?.played ?? 0 },
        { label: c('won'), value: (r) => r.record?.won ?? 0 },
        { label: c('drawn'), value: (r) => r.record?.drawn ?? 0 },
        { label: c('lost'), value: (r) => r.record?.lost ?? 0 },
        { label: c('goalsForAgainst'), value: (r) => `${r.record?.goals_for ?? 0}–${r.record?.goals_against ?? 0}` },
        { label: c('points'), value: (r) => r.record?.points ?? 0 },
        { label: c('attendance'), value: (r) => pct(r.attendance_rate) },
      ],
    },
    matches: {
      icon: Goal,
      filters: ['team', 'competition', 'season', 'from', 'to'],
      columns: [
        { label: c('date'), value: (r) => formatDate(r.date, lang) },
        { label: c('time'), value: (r) => formatTime(r.time) },
        { label: c('fixture'), value: (r) => `${r.home_team?.name} – ${r.away_team?.name}` },
        { label: c('score'), value: (r) => (r.home_score === null ? '—' : `${r.home_score}–${r.away_score}`) },
        { label: c('competition'), value: (r) => (r.competition ? `${r.competition.name} ${r.competition.season}` : t('matches.friendly')) },
        { label: c('status'), value: (r) => t(`status.${r.status}`) },
        { label: c('venue'), value: (r) => r.location },
        { label: c('referee'), value: (r) => r.referee || '—' },
      ],
    },
    attendance: {
      icon: ClipboardCheck,
      filters: ['team', 'from', 'to'],
      columns: [
        { label: c('player'), value: (r) => r.player.name },
        { label: c('team'), value: (r) => r.team?.name ?? '—' },
        { label: c('sessions'), value: (r) => r.total },
        { label: c('present'), value: (r) => r.present },
        { label: c('late'), value: (r) => r.late },
        { label: c('excused'), value: (r) => r.excused },
        { label: c('absent'), value: (r) => r.absent },
        { label: c('rate'), value: (r) => pct(r.rate) },
      ],
    },
    competitions: {
      icon: Trophy,
      filters: ['team', 'competition', 'season', 'from', 'to'],
      columns: [
        { label: c('competition'), value: (r) => r.name },
        { label: c('type'), value: (r) => t(`competitionTypes.${r.type}`) },
        { label: c('season'), value: (r) => r.season },
        { label: c('dates'), value: (r) => `${formatDate(r.start_date, lang)} – ${formatDate(r.end_date, lang)}` },
        { label: c('location'), value: (r) => r.location },
        { label: c('teams'), value: (r) => r.teams_count },
        { label: c('progress'), value: (r) => `${r.matches_played}/${r.matches_total}` },
        { label: c('goals'), value: (r) => r.goals },
        { label: c('status'), value: (r) => t(`status.${r.status}`) },
      ],
    },
    performance: {
      icon: FileSpreadsheet,
      filters: ['team', 'competition', 'season', 'from', 'to'],
      columns: [
        { label: c('player'), value: (r) => r.player.name },
        { label: c('team'), value: (r) => r.team?.name ?? '—' },
        { label: c('position'), value: (r) => t(`positions.${r.player.position}`) },
        { label: c('matches'), value: (r) => r.matches_played },
        { label: c('minutes'), value: (r) => num(r.minutes_played) },
        { label: c('goals'), value: (r) => r.goals },
        { label: c('assists'), value: (r) => r.assists },
        { label: c('yellow'), value: (r) => r.yellow_cards },
        { label: c('red'), value: (r) => r.red_cards },
        { label: c('rating'), value: (r) => (r.rating == null ? '—' : r.rating.toFixed(1)) },
        { label: c('attendance'), value: (r) => pct(r.attendance_rate) },
      ],
    },
  };
}
