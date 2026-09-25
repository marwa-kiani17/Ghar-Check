import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const isReportPage = location.pathname.startsWith('/report');

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="text-lg font-semibold text-foreground tracking-tight">GharCheck</span>
        </Link>

        {isReportPage && (
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark transition-colors no-underline cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Search Again
          </Link>
        )}
      </div>
    </header>
  );
}