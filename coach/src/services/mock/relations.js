/** Join helpers — shape records the way the REST API will return them (with embedded summaries). */

export const teamSummary = (db, id) => {
  const t = db.teams.find((x) => x.id === id);
  return t ? { id: t.id, name: t.name, short_name: t.short_name, color: t.color, logo: t.logo } : null;
};

export const playerSummary = (db, id) => {
  const p = db.players.find((x) => x.id === id);
  return p
    ? { id: p.id, name: p.name, photo: p.photo, position: p.position, jersey_number: p.jersey_number, team_id: p.team_id }
    : null;
};

export const coachSummary = (db, id) => {
  const c = db.coaches.find((x) => x.id === id);
  return c ? { id: c.id, name: c.name, photo: c.photo, license: c.license } : null;
};

export const competitionSummary = (db, id) => {
  const c = db.competitions.find((x) => x.id === id);
  return c ? { id: c.id, name: c.name, season: c.season, type: c.type } : null;
};

export const enrichMatch = (db, m) => ({
  ...m,
  home_team: teamSummary(db, m.home_team_id),
  away_team: teamSummary(db, m.away_team_id),
  competition: competitionSummary(db, m.competition_id),
});

export const enrichSession = (db, s) => ({
  ...s,
  team: teamSummary(db, s.team_id),
  coach: coachSummary(db, s.coach_id),
});
