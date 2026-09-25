import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getPropertyById, findComparables, getAreaTrend } from '../utils/database';
import type { PropertyData } from '../utils/database';
import { parsePrice, parseArea, parseAddedDate, formatPrice, extractSociety } from '../utils/parser';
import { scorePrice, scoreAgent, scoreQuality } from '../utils/scoring';
import BadgeCard from '../components/BadgeCard';
import WarningBanner from '../components/WarningBanner';

// 12 second timeout for scrape operations
export default function ReportPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const [searchParams] = useSearchParams();
  const sourceUrl = searchParams.get('url');

  const [property, setProperty] = useState<PropertyData | null | undefined>(undefined);
  // undefined = loading DB, null = not found, PropertyData = loaded
  const [status, setStatus] = useState<'loading_db' | 'scraping' | 'found' | 'not_found'>('loading_db');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadProperty = useCallback(async () => {
    if (!listingId) {
      setProperty(null);
      setStatus('not_found');
      return;
    }

    setProperty(undefined);
    setStatus('loading_db');
    setScrapeError(null);

    // Cancel any previous in-flight scrape
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Try the DB first — this will never take long (cached after first call)
    const result = await getPropertyById(listingId, sourceUrl || undefined);

    if (result) {
      setProperty(result);
      setStatus('found');
      return;
    }

    // If we got here, it means:
    //   a) not in local DB, AND
    //   b) scrape already failed (getPropertyById already tried it)
    // Show the not-found UI with whatever error info we have
    setProperty(null);
    setStatus('not_found');

    if (sourceUrl) {
      setScrapeError(
        'We could not fetch property data from Zameen.com. The URL might be invalid, ' +
        'the property may no longer be listed, or there was a connection issue.'
      );
    } else {
      setScrapeError(null);
    }
  }, [listingId, sourceUrl]);

  useEffect(() => {
    loadProperty();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [loadProperty]);

  // --- Loading state (DB lookup / scrape in progress) ---
  if (status === 'loading_db' || status === 'scraping') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="text-lg font-medium text-foreground">
            {status === 'loading_db' ? 'Looking up property...' : 'Generating your report...'}
          </div>
          <div className="text-sm text-gray-400">
            {status === 'loading_db'
              ? 'Checking our database'
              : 'Fetching property data from Zameen.com'
            }
          </div>
        </div>
      </div>
    );
  }

  // --- Not found state ---
  if (status === 'not_found' || !property) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Report Not Found</h1>
          <p className="text-gray-500 mb-1">
            {scrapeError || "This property isn't in our database yet."}
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Try another URL, or use one of the examples on the homepage.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all duration-200 active:scale-[0.97] cursor-pointer no-underline"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Try Another URL
          </Link>
        </div>
      </div>
    );
  }

  return <ReportContent property={property} />;
}

/* ── Report content separated so hooks are stable ── */

function ReportContent({ property }: { property: PropertyData }) {
  const [comparables, setComparables] = useState<PropertyData[]>([]);
  const [areaTrend, setAreaTrend] = useState<{ avgPricePerMarla: number; sampleSize: number } | null>(null);
  const [trendError, setTrendError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [compsResult, trendResult] = await Promise.all([
          findComparables(property),
          getAreaTrend(extractSociety(property.details_table.Location)),
        ]);
        if (!cancelled) {
          setComparables(compsResult);
          setAreaTrend(trendResult);
        }
      } catch {
        if (!cancelled) {
          setTrendError(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [property]);

  const priceResult = scorePrice(property, comparables);
  const agentResult = scoreAgent(property);
  const qualityResult = scoreQuality(property);
  const dateInfo = parseAddedDate(property.details_table.Added);
  const price = parsePrice(property.details_table.Price);
  const area = parseArea(property.details_table.Area);
  const totalAmenities = countAllAmenities(property);
  const society = extractSociety(property.details_table.Location);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in">
      {/* ⚠️ Prominent warnings at the top when agent untrusted, price out of range, or no data */}
      {agentResult.score === 'RED' && (
        <WarningBanner
          type="agent"
          message={`${property.agent.person} at ${property.agent.agency} has no verified badges on Zameen.com. This property is NOT listed by a Trusted agent.`}
          details="Look for agents with verified Trusted badges for a safer transaction."
        />
      )}
      {agentResult.score === 'YELLOW' && (
        <WarningBanner
          type="agent"
          message={`${property.agent.person} at ${property.agent.agency} has a Premium badge but not Trusted status on Zameen.com.`}
          details="Premium agents may be reliable, but Trusted agents offer the highest level of verification."
        />
      )}
      {priceResult.score === 'RED' && comparables.length > 0 && (
        <WarningBanner
          type="price"
          message={`Listing price is significantly outside the market average for similar properties in ${society}.`}
          details="Review the price analysis below for a detailed comparison."
        />
      )}
      {comparables.length === 0 && !trendError && (
        <WarningBanner
          type="price"
          message="No similar listings found in our database to compare prices for this property."
          details="The price check is based on available market trend data. We'll add more data over time."
        />
      )}

      {/* Property Summary Card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        {/* Hero Image */}
        <div className="relative h-56 sm:h-72 bg-gray-100">
          <img
            src={property.images[0]}
            alt={property.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" fill="%23e2e8f0"><rect width="800" height="400"/><text x="400" y="210" text-anchor="middle" fill="%2394a3b8" font-size="18">Image unavailable</text></svg>'; }}
          />
          {property.images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-lg">
              {property.images.length} photos
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 leading-tight">
            {property.title}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <DetailItem label="Price" value={formatPrice(price)} highlight />
            <DetailItem label="Area" value={`${area.value} ${area.unit}`} />
            <DetailItem label="Bedrooms" value={property.details_table['Bedroom(s)']} />
            <DetailItem label="Bathrooms" value={property.details_table['Bath(s)']} />
            <DetailItem label="Type" value={property.details_table.Type} />
            <DetailItem label="Purpose" value={property.details_table.Purpose} />
            <DetailItem label="Location" value={society} />
            <DetailItem label="Added" value={property.details_table.Added} />
          </div>
        </div>
      </div>

      {/* Three Badge Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <BadgeCard
          icon={
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
          label="Price Check"
          score={priceResult.score}
          reason={priceResult.reason}
        />
        <BadgeCard
          icon={
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          }
          label="Agent Check"
          score={agentResult.score}
          reason={agentResult.reason}
        />
        <BadgeCard
          icon={
            <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
          label="Quality Check"
          score={qualityResult.score}
          reason={qualityResult.reason}
        />
      </div>

      {/* Area Trend (always shown when DB has data for this society) */}
      {!trendError && areaTrend && (
        <SectionCard title={`${society} Market Trend`} icon={
          <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        }>
          <p className="text-sm text-gray-500 mb-2">
            Based on {areaTrend.sampleSize} listing{areaTrend.sampleSize !== 1 ? 's' : ''} in our database.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              PKR {formatPricePerMarla(areaTrend.avgPricePerMarla)}/Marla
            </span>
            <span className="text-sm text-gray-400">average in {society}</span>
          </div>
          {price > 0 && area.marlaValue > 0 && areaTrend.avgPricePerMarla > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              Expected price for {area.value} {area.unit}: <strong className="text-foreground">{formatPrice(areaTrend.avgPricePerMarla * area.marlaValue)}</strong>
            </div>
          )}
        </SectionCard>
      )}

      {/* Price Analysis */}
      <SectionCard title="Price Analysis" icon={
        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      }>
        <p className="text-sm text-gray-500 mb-4">
          Comparing {formatPrice(price)} against {comparables.length} similar listing{comparables.length !== 1 ? 's' : ''} in {society}.
        </p>

        {comparables.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-medium text-gray-500">Property</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Area</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
                  <th className="text-right pl-4 py-3 font-medium text-gray-500">vs. Avg</th>
                </tr>
              </thead>
              <tbody>
                {comparables.map((comp) => {
                  const compPrice = parsePrice(comp.details_table.Price);
                  const compArea = parseArea(comp.details_table.Area);
                  const compPricePerMarla = compPrice / compArea.marlaValue;
                  const avgPricePerMarla = comparables.reduce((sum, c) => {
                    const p = parsePrice(c.details_table.Price);
                    const a = parseArea(c.details_table.Area);
                    return sum + (p / a.marlaValue);
                  }, 0) / comparables.length;
                  const diffPercent = ((compPricePerMarla - avgPricePerMarla) / avgPricePerMarla) * 100;
                  const diffColor = Math.abs(diffPercent) <= 5 ? 'text-emerald-600' : 'text-gray-600';

                  return (
                    <tr key={comp.listing_id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground truncate max-w-[180px] sm:max-w-xs">
                          {comp.title}
                        </div>
                        <div className="text-xs text-gray-400">{comp.agent.agency}</div>
                      </td>
                      <td className="text-right px-4 py-3 text-gray-600 whitespace-nowrap">{comp.details_table.Area}</td>
                      <td className="text-right px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{formatPrice(compPrice)}</td>
                      <td className={`text-right pl-4 py-3 whitespace-nowrap ${diffColor}`}>
                        {diffPercent >= 0 ? '+': ''}{diffPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : areaTrend && !trendError ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No exact comparables found, but we have {areaTrend.sampleSize} listing{areaTrend.sampleSize !== 1 ? 's' : ''} from {society} in our database for reference.
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            No comparable listings found in this area.
          </div>
        )}
      </SectionCard>

      {/* Agent Check */}
      <SectionCard title="Agent Check" icon={
        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      }>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="font-semibold text-foreground">{property.agent.person}</div>
              <div className="text-sm text-gray-500">{property.agent.agency}</div>
            </div>

            <div className="flex flex-wrap gap-2 ml-auto">
              {property.badges.trusted && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  Trusted
                </span>
              )}
              {property.badges.titanium && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  Titanium
                </span>
              )}
              {property.badges.premium && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  Premium
                </span>
              )}
              {!property.badges.trusted && !property.badges.titanium && !property.badges.premium && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  No Badges
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active Listings</div>
              <div className="font-semibold text-foreground">N/A</div>
              <div className="text-xs text-gray-400 mt-0.5">(Coming soon)</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Agency</div>
              <div className="font-semibold text-foreground">{property.agent.agency}</div>
              <div className="text-xs text-gray-400 mt-0.5">Listed on Zameen.com</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Listing Quality */}
      <SectionCard title="Listing Quality" icon={
        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      }>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <QualityMetric
            label="Photos"
            value={`${property.images.length}`}
            sub={property.images.length >= 10 ? 'Comprehensive' : property.images.length >= 5 ? 'Adequate' : 'Limited'}
            good={property.images.length >= 10}
            fair={property.images.length >= 5}
          />
          <QualityMetric
            label="Amenities"
            value={`${totalAmenities}`}
            sub={totalAmenities >= 15 ? 'Comprehensive' : totalAmenities >= 8 ? 'Good' : 'Basic'}
            good={totalAmenities >= 15}
            fair={totalAmenities >= 8}
          />
          <QualityMetric
            label="Description"
            value={`${property.description.length} chars`}
            sub={property.description.length > 200 ? 'Detailed' : property.description.length > 100 ? 'Adequate' : 'Brief'}
            good={property.description.length > 200}
            fair={property.description.length > 100}
          />
          <QualityMetric
            label="Days Listed"
            value={`${dateInfo.daysAgo} days`}
            sub={dateInfo.daysAgo <= 7 ? 'Fresh listing' : dateInfo.daysAgo <= 30 ? 'Recent' : 'Consider urgency'}
            good={dateInfo.daysAgo <= 7}
            fair={dateInfo.daysAgo <= 30}
          />
        </div>
        <p className="text-sm text-gray-500 border-t border-border pt-3">{dateInfo.label}</p>
      </SectionCard>
    </div>
  );
}

/* ── Helper components ── */

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? 'text-emerald-600' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sm:p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function QualityMetric({ label, value, sub, good, fair }: { label: string; value: string; sub: string; good: boolean; fair: boolean }) {
  return (
    <div className="text-center p-3 rounded-xl bg-gray-50">
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className={`text-xs font-medium ${good ? 'text-emerald-600' : fair ? 'text-amber-600' : 'text-red-600'}`}>
        {sub}
      </div>
    </div>
  );
}

function countAllAmenities(property: PropertyData): number {
  let count = 0;
  for (const group of Object.values(property.amenities)) {
    count += group.items.length;
  }
  return count;
}

function formatPricePerMarla(price: number): string {
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(2)}M`;
  }
  if (price >= 100_000) {
    return `${(price / 100_000).toFixed(1)}L`;
  }
  return price.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}