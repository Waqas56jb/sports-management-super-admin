import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function BackLink({ to, children }) {
  return (
    <Link to={to} className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-ink-3 hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}
