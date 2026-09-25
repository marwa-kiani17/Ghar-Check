import { useState } from 'react';

interface WarningBannerProps {
  type: 'agent' | 'price';
  message: string;
  details?: string;
}

export default function WarningBanner({ type, message, details }: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isAgent = type === 'agent';

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 mb-6 animate-fade-in ${
        isAgent
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isAgent ? 'bg-red-100' : 'bg-amber-100'
          }`}
        >
          {isAgent ? (
            /* Shield with exclamation (agent untrusted) */
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            /* Alert triangle (price mismatch) */
            <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base ${
            isAgent ? 'text-red-800' : 'text-amber-800'
          }`}>
            {isAgent ? '⚠️ Unverified Agent' : '⚠️ Price Out of Range'}
          </h3>
          <p className={`text-sm mt-1 ${
            isAgent ? 'text-red-700' : 'text-amber-700'
          }`}>
            {message}
          </p>
          {details && (
            <p className={`text-xs mt-1 ${
              isAgent ? 'text-red-500' : 'text-amber-600'
            }`}>
              {details}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isAgent
              ? 'text-red-400 hover:bg-red-200 hover:text-red-600'
              : 'text-amber-400 hover:bg-amber-200 hover:text-amber-600'
          }`}
          aria-label="Dismiss warning"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}