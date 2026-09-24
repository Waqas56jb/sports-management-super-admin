import { Link } from 'react-router-dom';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';

/** Avatar + name + secondary line, used in tables and lists. */
export default function PersonCell({ name, photo, sub, to, size = 'md', className, trailing }) {
  const nameNode = to ? (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="truncate font-medium text-ink hover:underline">
      {name}
    </Link>
  ) : (
    <span className="truncate font-medium text-ink">{name}</span>
  );
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar name={name} src={photo} size={size} />
      <div className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          {nameNode}
          {trailing}
        </span>
        {sub && <span className="truncate text-xs text-ink-3">{sub}</span>}
      </div>
    </div>
  );
}
