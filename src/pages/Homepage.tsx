import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractListingId } from '../utils/parser';

const EXAMPLE_URLS = [
  {
    label: 'Safari Valley 7 Marla',
    url: 'https://www.zameen.com/Property/bahria_town_phase_8_bahria_town_phase_8_-_safari_valley_7_marla_house_for_sale-54418008-3074-1.html'
  },
  {
    label: 'C Block 10 Marla',
    url: 'https://www.zameen.com/Property/bahria_town_phase_8_bahria_town_phase_8_-_block_c_10_marla_double_unit_house_c_block_bahria_town_rawalpindi-54175209-3051-1.html'
  },
  {
    label: 'Overseas 5 Designer',
    url: 'https://www.zameen.com/Property/bahria_greens_overseas_enclave_bahria_greens_-_overseas_enclave_-_sector_5_10_marla_double_unit_designer_house_overseas_5_street_11_bahria_town_rawalpindi-54175276-8304-1.html'
  }
];

export default function Homepage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmedUrl = url.trim();
  const isValidZameenUrl = trimmedUrl.toLowerCase().includes('zameen.com') && extractListingId(trimmedUrl) !== null;

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!trimmedUrl) {
      setError('Please enter a Zameen.com URL.');
      return;
    }

    if (!trimmedUrl.toLowerCase().includes('zameen.com')) {
      setError('Please enter a valid Zameen.com URL.');
      return;
    }

    const listingId = extractListingId(trimmedUrl);
    if (!listingId) {
      setError('Could not extract a property ID from that URL. Please check the link.');
      return;
    }

    setLoading(true);

    // Navigate to the report page — it will try DB first, then scrape live
    const encodedUrl = encodeURIComponent(trimmedUrl);
    navigate(`/report/${listingId}?url=${encodedUrl}`);
  }, [trimmedUrl, navigate]);

  const handleExampleClick = useCallback((exampleUrl: string) => {
    setUrl(exampleUrl);
    setError(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidZameenUrl && !loading) {
      handleSubmit();
    }
  }, [isValidZameenUrl, loading, handleSubmit]);

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-white to-white pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4">
            Your Property Trust Report
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-xl mx-auto mb-10">
            Paste any Zameen.com URL to instantly check price fairness, agent trustworthiness, and listing quality.
          </p>

          {/* Input Area */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Paste Zameen.com property URL here..."
                className="w-full px-5 py-4 pr-36 text-base bg-white border-2 border-border rounded-2xl shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-primary focus:shadow-md transition-all duration-200"
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={handleSubmit}
                  disabled={!isValidZameenUrl || loading}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="spinner" />
                      Loading...
                    </>
                  ) : (
                    'Generate Full Report'
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Example buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-gray-400">Try an example:</span>
            {EXAMPLE_URLS.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(ex.url)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-border rounded-xl hover:border-primary hover:text-primary hover:bg-emerald-50/50 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Paste URL',
              desc: 'Copy any Zameen.com property listing URL and paste it into the search box.'
            },
            {
              step: '2',
              title: 'AI Analysis',
              desc: 'We analyze price, agent credentials, and listing quality against market data.'
            },
            {
              step: '3',
              title: 'Get Report',
              desc: 'Receive a clear trust report with color-coded badges and detailed insights.'
            }
          ].map((item, i) => (
            <div key={i} className="text-center p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-primary font-semibold text-lg flex items-center justify-center mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}