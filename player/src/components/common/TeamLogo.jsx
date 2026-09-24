import { Link } from 'react-router-dom';
import { TEAM_COLOR_VARS } from '@/utils/constants';
import { cn } from '@/utils/cn';

const SIZES = { xs: 'size-5', sm: 'size-7', md: 'size-9', lg: 'size-14', xl: 'size-20', '2xl': 'size-24' };

/** Uploaded logo, or a generated crest in the team's fixed colour. */
export default function TeamLogo({ team, size = 'md', className }) {
  if (!team) return <span className={cn('inline-block shrink-0 rounded-md bg-surface-3', SIZES[size], className)} aria-hidden="true" />;
  if (team.logo) {
    return <img src={team.logo} alt="" className={cn('shrink-0 rounded-lg object-contain', SIZES[size], className)} loading="lazy" />;
  }
  const color = TEAM_COLOR_VARS[(team.color ?? 0) % TEAM_COLOR_VARS.length];
  const label = (team.short_name || team.name?.slice(0, 3) || '').toUpperCase();
  return (
    <svg viewBox="0 0 40 46" className={cn('shrink-0', SIZES[size], className)} aria-hidden="true">
      <path d="M20 1.5 37.5 7v15.5C37.5 34 29.8 41 20 44.5 10.2 41 2.5 34 2.5 22.5V7L20 1.5Z" style={{ fill: color }} />
      <path d="M20 1.5 37.5 7v15.5C37.5 34 29.8 41 20 44.5Z" fill="#000" fillOpacity="0.12" />
      <path d="M20 5 34 9.4v13.1C34 31.9 27.9 37.8 20 40.9 12.1 37.8 6 31.9 6 22.5V9.4L20 5Z" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
      <text x="20" y="27" textAnchor="middle" fontFamily="'Barlow Condensed', Inter, sans-serif" fontWeight="700" fontSize={label.length > 3 ? 9 : 11.5} fill="#fff" letterSpacing="0.4">
        {label}
      </text>
    </svg>
  );
}

/** Logo + name, optionally linking to the team page. */
export function TeamChip({ team, size = 'sm', link = true, className, muted }) {
  if (!team) return <span className="text-ink-3">—</span>;
  const content = (
    <>
      <TeamLogo team={team} size={size} />
      <span className={cn('truncate font-medium', muted ? 'text-ink-2' : 'text-ink')}>{team.name}</span>
    </>
  );
  const classes = cn('inline-flex min-w-0 max-w-full items-center gap-2', className);
  return link ? (
    <Link to="/player/team" onClick={(e) => e.stopPropagation()} className={cn(classes, 'hover:underline')}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
