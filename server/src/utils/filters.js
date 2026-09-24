/**
 * Safe SQL building blocks. Values are ALWAYS bound as parameters ($1, $2…); identifiers (sort
 * columns) only ever come from server-side allow-lists, never from the client.
 */

/** Accepts both the spec's snake_case names and the frontends' camelCase names. */
const ALIASES = {
  teamId: 'team_id',
  competitionId: 'competition_id',
  playerId: 'player_id',
  coachId: 'coach_id',
  sessionId: 'session_id',
  trainingId: 'session_id',
  from: 'date_from',
  to: 'date_to',
  sort: 'sortBy',
  dir: 'sortOrder',
  attendance_status: 'status',
  q: 'search',
  matchType: 'match_type',
};

export function normalizeQuery(query = {}) {
  const out = {};
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (value === undefined || value === null || value === '') continue;
    const k = ALIASES[key] ?? key;
    if (out[k] === undefined) out[k] = value;
  }
  return out;
}

/** Escapes LIKE wildcards so user input is matched literally. */
export const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

export class SqlBuilder {
  constructor(params = []) {
    this.params = params;
    this.parts = [];
  }

  /** Binds a value and returns its placeholder. */
  bind(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  /** where('m.status = ?', status) — each ? becomes a bound parameter. */
  where(sql, ...values) {
    let i = 0;
    this.parts.push(sql.replace(/\?/g, () => this.bind(values[i++])));
    return this;
  }

  whereIf(condition, sql, ...values) {
    if (condition !== undefined && condition !== null && condition !== '' && condition !== false) this.where(sql, ...values);
    return this;
  }

  /** Accent- and case-insensitive "contains" across several columns. */
  search(term, columns) {
    if (!term || !String(term).trim()) return this;
    const p = this.bind(`%${likeEscape(String(term).trim())}%`);
    this.parts.push(`(${columns.map((c) => `unaccent_ci(coalesce(${c}::text, '')) LIKE unaccent_ci(${p})`).join(' OR ')})`);
    return this;
  }

  get clause() {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }

  get and() {
    return this.parts.length ? `AND ${this.parts.join(' AND ')}` : '';
  }
}

/**
 * ORDER BY from an allow-list: allowed = { apiName: 'sql expression' }.
 * Unknown columns fall back to the default; direction is constrained to ASC/DESC.
 */
export function orderBy(sortBy, sortOrder, allowed, fallback, tieBreaker = '') {
  const expr = allowed[sortBy] ?? allowed[fallback.column];
  const dir = String(sortOrder ?? fallback.order ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const nulls = dir === 'DESC' ? 'NULLS LAST' : 'NULLS LAST';
  return `ORDER BY ${expr} ${dir} ${nulls}${tieBreaker ? `, ${tieBreaker}` : ''}`;
}
