import { supabase } from './supabase';
import { extractListingId, parseArea, parsePrice, extractSociety } from './parser';

export interface PropertyData {
  listing_id: string;
  url: string;
  title: string;
  details_table: {
    Type: string;
    Price: string;
    'Bath(s)': string;
    Area: string;
    Purpose: string;
    'Bedroom(s)': string;
    Added: string;
    Location: string;
  };
  amenities: Record<string, { items: string[] }>;
  description: string;
  agent: {
    agency: string;
    person: string;
  };
  badges: {
    trusted: boolean;
    titanium: boolean;
    premium: boolean;
  };
  images: string[];
}

// In-memory cache to avoid repeated Supabase calls
let cachedProperties: PropertyData[] | null = null;

/**
 * Fetches all properties from Supabase (or returns cached data).
 */
async function loadAllProperties(): Promise<PropertyData[]> {
  if (cachedProperties) return cachedProperties;

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('data')
      .order('id', { ascending: true });

    if (error) {
      console.error('Failed to load properties from Supabase:', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      console.warn('Supabase returned unexpected data format:', data);
      return [];
    }

    cachedProperties = data
      .filter(row => row && row.data && typeof row.data === 'object')
      .map(row => row.data as PropertyData);
    return cachedProperties;
  } catch (err) {
    console.error('Unexpected error loading properties:', err);
    return [];
  }
}

/**
 * Finds a property by its Zameen.com URL.
 * Extracts the listing ID from the URL and matches against the dataset.
 */
export async function getPropertyByUrl(url: string): Promise<PropertyData | null> {
  const listingId = extractListingId(url);
  if (!listingId) return null;
  return getPropertyById(listingId);
}

/**
 * Finds a property by its listing ID.
 * Checks the local DB first, then falls back to the scrape Edge Function.
 */
export async function getPropertyById(id: string, sourceUrl?: string): Promise<PropertyData | null> {
  // First try local DB
  const properties = await loadAllProperties();
  const local = properties.find(p => p.listing_id === id);
  if (local) return local;

  // Not in DB — try scraping via Edge Function
  return scrapeProperty(id, sourceUrl);
}

/**
 * Calls the Zameen scrape Edge Function to fetch a property in real-time.
 */
async function scrapeProperty(_listingId: string, url?: string): Promise<PropertyData | null> {
  if (!url) return null;

  try {
    const supabaseUrl = 'https://atywnmldzhwniguvinpa.supabase.co';
    const response = await fetch(
      `${supabaseUrl}/functions/v1/scrape-zameen`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eXdubWxkemh3bmlndXZpbnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQyMzEsImV4cCI6MjEwMTg0MDIzMX0.rssSR4bo7alDqzlkU2sjU9eV6Cz5yIaS2M5F2_QEbrA',
        },
        body: JSON.stringify({ url }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Scrape failed:', err);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error('Scrape error:', data.error);
      return null;
    }

    return data.property as PropertyData;
  } catch (err) {
    console.error('Failed to scrape property:', err);
    return null;
  }
}

/**
 * Finds comparable properties for a given listing.
 * Strategy:
 *   1. Match same society, same type, area within ±30%
 *   2. Fallback: broader society (e.g. "Bahria Town" from "Bahria Town Phase 8"), same type, area ±30%
 *   3. Last resort: same city (extracted from full location), same type, area ±30%
 * Returns up to 3 closest matches sorted by area difference, excluding the current listing.
 */
export async function findComparables(property: PropertyData): Promise<PropertyData[]> {
  const properties = await loadAllProperties();
  const fullLocation = property.details_table.Location;
  const society = extractSociety(fullLocation);
  const propType = property.details_table.Type;
  const propArea = parseArea(property.details_table.Area);

  if (propArea.marlaValue === 0) return [];

  const minArea = propArea.marlaValue * 0.7;
  const maxArea = propArea.marlaValue * 1.3;

  // Extract broader society name (e.g. "Bahria Town" from "Bahria Town Phase 8")
  const broaderSociety = society.replace(/\s+(Phase|Sector|Block)\s*\d*.*$/i, '').trim();
  // Extract city (e.g. "Rawalpindi" or "Islamabad")
  const cityMatch = fullLocation.match(/,\s*([^,]+)/);
  const city = cityMatch ? cityMatch[1].trim() : '';

  const inArea = (p: PropertyData, societyName: string) =>
    extractSociety(p.details_table.Location) === societyName;

  const inBroaderArea = (p: PropertyData) =>
    broaderSociety && broaderSociety !== society &&
    extractSociety(p.details_table.Location).toLowerCase().includes(broaderSociety.toLowerCase());

  const inCity = (p: PropertyData) =>
    city && p.details_table.Location.toLowerCase().includes(city.toLowerCase());

  const isMatch = (p: PropertyData) => {
    if (p.listing_id === property.listing_id) return false;
    if (p.details_table.Type !== propType) return false;
    const area = parseArea(p.details_table.Area);
    if (area.marlaValue === 0) return false;
    if (area.marlaValue < minArea || area.marlaValue > maxArea) return false;
    return true;
  };

  // Priority 1: exact society match
  let candidates = properties.filter(p => isMatch(p) && inArea(p, society));

  // Priority 2: broader society match
  if (candidates.length === 0 && broaderSociety !== society) {
    candidates = properties.filter(p => isMatch(p) && inBroaderArea(p));
  }

  // Priority 3: city-level match
  if (candidates.length === 0 && city) {
    candidates = properties.filter(p => isMatch(p) && inCity(p));
  }

  // Sort by absolute area difference
  candidates.sort((a, b) => {
    const diffA = Math.abs(parseArea(a.details_table.Area).marlaValue - propArea.marlaValue);
    const diffB = Math.abs(parseArea(b.details_table.Area).marlaValue - propArea.marlaValue);
    return diffA - diffB;
  });

  return candidates.slice(0, 3);
}

/**
 * Computes area trend: average price per marla for a society from the DB.
 * Falls back to broader society or city level if exact match returns 0 results.
 */
export async function getAreaTrend(society: string): Promise<{ avgPricePerMarla: number; sampleSize: number } | null> {
  const properties = await loadAllProperties();

  // Try exact society match first
  let matched = properties.filter(p => extractSociety(p.details_table.Location) === society);

  // Try broader society match
  if (matched.length === 0) {
    const broader = society.replace(/\s+(Phase|Sector|Block)\s*\d*.*$/i, '').trim();
    if (broader !== society) {
      matched = properties.filter(p =>
        extractSociety(p.details_table.Location).toLowerCase().includes(broader.toLowerCase())
      );
    }
  }

  let totalPricePerMarla = 0;
  let count = 0;

  for (const p of matched) {
    const price = parsePrice(p.details_table.Price);
    const area = parseArea(p.details_table.Area);
    if (price > 0 && area.marlaValue > 0) {
      totalPricePerMarla += price / area.marlaValue;
      count++;
    }
  }

  if (count === 0) return null;

  return {
    avgPricePerMarla: totalPricePerMarla / count,
    sampleSize: count,
  };
}

/**
 * Returns all properties (for listing purposes).
 */
export async function getAllProperties(): Promise<PropertyData[]> {
  return loadAllProperties();
}