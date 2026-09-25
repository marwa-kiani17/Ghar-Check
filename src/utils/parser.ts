/**
 * Extracts the listing ID from a Zameen.com URL.
 * Pattern: /Property/...-{listingId}-{number}-{number}.html
 */
export function extractListingId(url: string): string | null {
  const match = url.match(/-(\d+)-\d+-\d+\.html$/);
  return match ? match[1] : null;
}

/**
 * Parses a PKR price string to a numeric value.
 * Examples: "PKR 2.95 Crore" → 29500000, "PKR 5.0 Crore" → 50000000
 */
export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/PKR\s*/i, '').trim();

  // Crore
  const croreMatch = cleaned.match(/^([\d.]+)\s*Crore$/i);
  if (croreMatch) {
    return parseFloat(croreMatch[1]) * 10_000_000;
  }

  // Lakh
  const lakhMatch = cleaned.match(/^([\d.]+)\s*Lakh$/i);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * 100_000;
  }

  // Plain number (e.g. "25,000,000")
  const num = parseFloat(cleaned.replace(/,/g, ''));
  if (!isNaN(num)) return num;

  return 0;
}

/**
 * Parses area string to value and unit.
 * Examples: "7 Marla" → { value: 7, unit: "Marla" }
 * "1 Kanal" → { value: 1, unit: "Kanal" }
 * Converts Kanal to Marla for comparison (1 Kanal = 20 Marla)
 */
export function parseArea(areaStr: string): { value: number; unit: string; marlaValue: number } {
  const match = areaStr.match(/^([\d.]+)\s*(Marla|Kanal|Square\s*(Feet|Meters|Yards)|Sq\.?\s*(ft|m|yd))/i);
  if (!match) {
    return { value: 0, unit: 'Unknown', marlaValue: 0 };
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  let marlaValue = 0;
  if (unit.toLowerCase().startsWith('marla')) {
    marlaValue = value;
  } else if (unit.toLowerCase().startsWith('kanal')) {
    marlaValue = value * 20;
  } else {
    // Approximate conversions for other units
    marlaValue = value; // fallback
  }

  return { value, unit, marlaValue };
}

/**
 * Parses a relative date string to structured data.
 * Examples: "15 hours ago", "2 days ago", "1 week ago", "1 month ago"
 */
export function parseAddedDate(dateStr: string): { daysAgo: number; label: string } {
  const lower = dateStr.toLowerCase();

  const hourMatch = lower.match(/^(\d+)\s*hours?\s*ago$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    return { daysAgo: Math.round(hours / 24), label: `${hours} hour${hours > 1 ? 's' : ''} ago — Fresh listing` };
  }

  const dayMatch = lower.match(/^(\d+)\s*days?\s*ago$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    return {
      daysAgo: days,
      label: `Listed ${days} day${days > 1 ? 's' : ''} ago${days <= 3 ? ' — Fresh listing' : days <= 14 ? ' — Recent' : ' — Consider urgency'}`
    };
  }

  const weekMatch = lower.match(/^(\d+)\s*weeks?\s*ago$/);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1]);
    const days = weeks * 7;
    return {
      daysAgo: days,
      label: `Listed ${weeks} week${weeks > 1 ? 's' : ''} ago${days <= 14 ? ' — Recent' : ' — Consider urgency'}`
    };
  }

  const monthMatch = lower.match(/^(\d+)\s*months?\s*ago$/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1]);
    const days = months * 30;
    return {
      daysAgo: days,
      label: `Listed ${months} month${months > 1 ? 's' : ''} ago — Consider urgency`
    };
  }

  return { daysAgo: 0, label: dateStr };
}

/**
 * Formats a numeric price to a readable PKR string.
 * E.g. 29500000 → "PKR 2.95 Crore"
 */
export function formatPrice(price: number): string {
  if (price >= 10_000_000) {
    const crores = (price / 10_000_000).toFixed(price % 10_000_000 === 0 ? 0 : 2);
    return `PKR ${parseFloat(crores).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Crore`;
  }
  if (price >= 100_000) {
    const lakhs = (price / 100_000).toFixed(price % 100_000 === 0 ? 0 : 1);
    return `PKR ${lakhs} Lakh`;
  }
  return `PKR ${price.toLocaleString('en-PK')}`;
}

/**
 * Extracts the society/city name from a location string.
 * E.g. "Bahria Town Rawalpindi, Rawalpindi, Punjab" → "Bahria Town Rawalpindi"
 */
export function extractSociety(location: string): string {
  return location.split(',')[0].trim();
}