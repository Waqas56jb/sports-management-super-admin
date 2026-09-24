export default {
  title: 'Présences',
  description: 'Présence aux entraînements par équipe, joueur et séance.',
  filters: {
    player: 'Joueur',
    allPlayers: 'Tous les joueurs',
  },
  kpi: {
    rate: 'Taux de présence',
    rateSub: 'Présents ou en retard ÷ pointages',
    present: 'Présents',
    late: 'Retards',
    excused: 'Excusés',
    absent: 'Absents',
  },
  charts: {
    trend: 'Évolution des présences',
    trendSub: 'Taux hebdomadaire par équipe',
    byTeam: 'Présence par équipe',
    byTeamSub: 'Part des pointages présents ou en retard',
    rate: 'Taux',
  },
  tabs: {
    players: 'Par joueur',
    sessions: 'Par séance',
    records: 'Tous les pointages',
  },
  columns: {
    player: 'Joueur',
    team: 'Équipe',
    sessions: 'Séances',
    rate: 'Taux',
    session: 'Séance',
    date: 'Date',
    status: 'Statut',
    notes: 'Remarques',
  },
  needsAttention: 'Sous 75 %',
  empty: {
    title: 'Aucune présence enregistrée',
    description: 'Les présences apparaissent ici dès que les entraîneurs font l’appel.',
  },
  statusFilterHint: 'Le filtre de statut s’applique à la liste des pointages.',
};
