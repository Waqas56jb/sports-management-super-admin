import { useI18n } from '@/i18n';
import { TEAM_COLOR_VARS } from '@/utils/constants';

const ORDER = { goalkeeper: 0, defender: 1, midfielder: 2, forward: 3 };

/** Split the starting XI into lines (GK + formation lines) ordered by position. */
export function linesFor(formation, starters) {
  const sizes = [1, ...String(formation || '4-3-3').split('-').map(Number)];
  const sorted = [...starters].sort((a, b) => (ORDER[a.position] ?? 9) - (ORDER[b.position] ?? 9) || (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
  const lines = [];
  let i = 0;
  sizes.forEach((size) => {
    lines.push(sorted.slice(i, i + size));
    i += size;
  });
  if (i < sorted.length) lines[lines.length - 1].push(...sorted.slice(i));
  return lines;
}

const surname = (name = '') => name.split(' ').slice(-1)[0];

/** Vertical half-pitch showing a formation. Goalkeeper at the bottom, attack at the top. */
export default function PitchView({ formation, starters, team }) {
  const { t } = useI18n();
  const lines = linesFor(formation, starters);
  const color = TEAM_COLOR_VARS[(team?.color ?? 0) % TEAM_COLOR_VARS.length];
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0f6b4f] px-2 py-4 dark:bg-[#0c4a39]" role="img" aria-label={`${team?.name} — ${t('matches.lineup.formation')} ${formation}`}>
      <div className="absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 34px, transparent 34px 68px)' }} />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
          <rect x="3" y="3" width="94" height="134" />
          <line x1="3" y1="3" x2="97" y2="3" />
          <rect x="25" y="113" width="50" height="24" />
          <rect x="38" y="128" width="24" height="9" />
          <path d="M 35 3 A 15 15 0 0 0 65 3" />
        </g>
      </svg>
      <div className="relative flex min-h-80 flex-col-reverse justify-between gap-3">
        {lines.map((line, li) => (
          <div key={li} className="flex justify-around gap-1">
            {line.map((p) => (
              <div key={p.id} className="flex w-16 flex-col items-center text-center">
                <span
                  className="grid size-9 place-items-center rounded-full border-2 border-white/90 font-display text-sm font-bold text-white shadow-md tabular"
                  style={{ background: p.position === 'goalkeeper' ? '#111827' : color }}
                >
                  {p.jersey_number ?? '–'}
                </span>
                <span className="mt-1 max-w-full truncate rounded bg-black/35 px-1 text-[11px] font-medium leading-4 text-white">{surname(p.name)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
