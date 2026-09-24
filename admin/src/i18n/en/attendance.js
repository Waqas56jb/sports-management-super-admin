export default {
  title: 'Attendance',
  description: 'Training attendance across teams, players and sessions.',
  filters: {
    player: 'Player',
    allPlayers: 'All players',
  },
  kpi: {
    rate: 'Attendance rate',
    rateSub: 'Present or late ÷ check-ins',
    present: 'Present',
    late: 'Late',
    excused: 'Excused',
    absent: 'Absent',
  },
  charts: {
    trend: 'Attendance trend',
    trendSub: 'Weekly rate by team',
    byTeam: 'Attendance by team',
    byTeamSub: 'Share of check-ins marked present or late',
    rate: 'Rate',
  },
  tabs: {
    players: 'By player',
    sessions: 'By session',
    records: 'All records',
  },
  columns: {
    player: 'Player',
    team: 'Team',
    sessions: 'Sessions',
    rate: 'Rate',
    session: 'Session',
    date: 'Date',
    status: 'Status',
    notes: 'Notes',
  },
  needsAttention: 'Below 75%',
  empty: {
    title: 'No attendance recorded',
    description: 'Attendance appears here once coaches take the register at training.',
  },
  statusFilterHint: 'The status filter applies to the records list.',
};
