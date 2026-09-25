import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="text-6xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all duration-200 active:scale-[0.97] cursor-pointer no-underline"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}