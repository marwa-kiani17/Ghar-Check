import type { PropertyData } from './database';
import { parsePrice, parseArea } from './parser';

export type Score = 'GREEN' | 'YELLOW' | 'RED';

export interface ScoreResult {
  score: Score;
  reason: string;
}

/**
 * Price scoring:
 * - GREEN: listing price is within 10% of comparable average
 * - YELLOW: listing price is within 25% of comparable average
 * - RED: otherwise
 */
export function scorePrice(property: PropertyData, comparables: PropertyData[]): ScoreResult {
  if (comparables.length === 0) {
    return {
      score: 'YELLOW',
      reason: 'No comparable listings found in this area to benchmark price.'
    };
  }

  const listingPrice = parsePrice(property.details_table.Price);
  if (listingPrice === 0) {
    return { score: 'YELLOW', reason: 'Unable to parse listing price.' };
  }

  // Calculate average price per marla from comparables for fair comparison
  let avgPricePerMarla = 0;
  for (const comp of comparables) {
    const compPrice = parsePrice(comp.details_table.Price);
    const compArea = parseArea(comp.details_table.Area);
    if (compPrice > 0 && compArea.marlaValue > 0) {
      avgPricePerMarla += compPrice / compArea.marlaValue;
    }
  }
  avgPricePerMarla /= comparables.length;

  const propArea = parseArea(property.details_table.Area);
  const expectedPrice = avgPricePerMarla * propArea.marlaValue;

  if (expectedPrice === 0) {
    return { score: 'YELLOW', reason: 'Unable to calculate benchmark price.' };
  }

  const diffPercent = ((listingPrice - expectedPrice) / expectedPrice) * 100;
  const absDiff = Math.abs(diffPercent);
  const direction = diffPercent > 0 ? 'above' : 'below';

  if (absDiff <= 10) {
    return {
      score: 'GREEN',
      reason: `PKR ${formatPriceShort(listingPrice)} is ${direction} the market average by only ${absDiff.toFixed(1)}%. Fair price.`
    };
  }

  if (absDiff <= 25) {
    return {
      score: 'YELLOW',
      reason: `PKR ${formatPriceShort(listingPrice)} is ${direction} the market average by ${absDiff.toFixed(1)}%. Moderately priced.`
    };
  }

  return {
    score: 'RED',
    reason: `PKR ${formatPriceShort(listingPrice)} is ${direction} the market average by ${absDiff.toFixed(1)}%. Significantly overpriced.`
  };
}

/**
 * Agent scoring:
 * - GREEN: has "trusted" badge
 * - YELLOW: has "premium" badge (but not trusted)
 * - RED: no badges at all
 */
export function scoreAgent(property: PropertyData): ScoreResult {
  const { trusted, premium } = property.badges;

  if (trusted) {
    return {
      score: 'GREEN',
      reason: `${property.agent.person} at ${property.agent.agency} is a Trusted agent on Zameen.com.`
    };
  }

  if (premium) {
    return {
      score: 'YELLOW',
      reason: `${property.agent.person} at ${property.agent.agency} has a Premium badge but not Trusted status.`
    };
  }

  return {
    score: 'RED',
    reason: `${property.agent.person} at ${property.agent.agency} has no verified badges on Zameen.com. Exercise caution.`
  };
}

/**
 * Quality scoring:
 * - GREEN: >= 10 photos AND description > 100 characters
 * - YELLOW: >= 5 photos (or description > 100 chars)
 * - RED: otherwise
 */
export function scoreQuality(property: PropertyData): ScoreResult {
  const photoCount = property.images.length;
  const descLength = property.description.length;
  const amenityCount = countAmenities(property);

  if (photoCount >= 10 && descLength > 100) {
    return {
      score: 'GREEN',
      reason: `${photoCount} photos, ${amenityCount} amenities, and a detailed description. Comprehensive listing.`
    };
  }

  if (photoCount >= 5) {
    return {
      score: 'YELLOW',
      reason: `${photoCount} photos with ${amenityCount} amenities. Decent listing quality but could be more detailed.`
    };
  }

  return {
    score: 'RED',
    reason: `Only ${photoCount} photos with ${amenityCount} amenities and limited description. Poor listing quality.`
  };
}

function countAmenities(property: PropertyData): number {
  let count = 0;
  for (const group of Object.values(property.amenities)) {
    count += group.items.length;
  }
  return count;
}

function formatPriceShort(price: number): string {
  if (price >= 10_000_000) {
    return `${(price / 10_000_000).toFixed(2)} Cr`;
  }
  if (price >= 100_000) {
    return `${(price / 100_000).toFixed(1)} L`;
  }
  return price.toLocaleString('en-PK');
}