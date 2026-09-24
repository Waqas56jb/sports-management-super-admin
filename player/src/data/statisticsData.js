/**
 * Detailed per-match performance model (shots, passes, fouls…).
 * Goals, assists, cards and minutes come from real match events; the detailed figures are
 * derived deterministically from them so they stay consistent (goals ≤ shots on target ≤ shots).
 */

function noise(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000; // 0 … 1
}

const PROFILE = {
  goalkeeper: { shots: 0, passes: 28, accuracy: 72, keyPasses: 0, fouls: 0.1 },
  defender: { shots: 0.5, passes: 46, accuracy: 86, keyPasses: 0.3, fouls: 1.4 },
  midfielder: { shots: 1.4, passes: 52, accuracy: 84, keyPasses: 1.4, fouls: 1.1 },
  forward: { shots: 3.2, passes: 24, accuracy: 74, keyPasses: 1.1, fouls: 0.9 },
};

/** Adds shots, shots_on_target, passes, completed_passes, key_passes and fouls to a match line. */
export function extendLine(line, position, matchId) {
  const p = PROFILE[position] ?? PROFILE.midfielder;
  const k = `${line.player_id}|${matchId}`;
  const share = Math.min(1, line.minutes / 90);
  const onTarget = line.goals + Math.round(p.shots * 0.45 * share * (0.5 + noise(`${k}t`)));
  const shots = onTarget + Math.round(p.shots * 0.55 * share * (0.4 + noise(`${k}s`) * 1.2));
  const passes = Math.round(p.passes * share * (0.75 + noise(`${k}p`) * 0.5));
  const accuracy = Math.min(96, Math.max(55, p.accuracy + (noise(`${k}a`) - 0.5) * 14 + (line.rating - 6.5) * 2));
  return {
    ...line,
    shots,
    shots_on_target: onTarget,
    passes,
    completed_passes: Math.round((passes * accuracy) / 100),
    key_passes: line.assists + Math.round(p.keyPasses * share * noise(`${k}k`) * 1.5),
    fouls: Math.round(p.fouls * share * noise(`${k}f`) * 2),
  };
}
