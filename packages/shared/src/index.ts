export type DealStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'GENERATED'
  | 'SCHEDULED'
  | 'POSTED'
  | 'FAILED'
  | 'DUPLICATE_PENDING'
  | 'DISCARDED';

export type Platform = 'MEESHO' | 'AMAZON' | 'OTHER';

export interface SystemSelectors {
  wishlinkUrlInput: string;
  wishlinkGenerateBtn: string;
  wishlinkShortlinkText: string;
}

export interface DealInput {
  externalUrl: string;
  productName: string;
  mrp: number;
  offerPrice: number;
  scheduledTime?: string;
}

/**
 * Normalizes Amazon and Meesho URLs by removing referral and tracker parameters
 * to ensure reliable duplicate checking.
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);

    // Normalize hostnames
    const host = url.hostname.toLowerCase();

    if (host.includes('amazon.')) {
      // Keep only product ID path (/dp/B0xxxxxx or /gp/product/B0xxxxxx)
      const dpMatch = url.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      const gpMatch = url.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      const asin = (dpMatch && dpMatch[1]) || (gpMatch && gpMatch[1]);
      if (asin) {
        return `https://www.amazon.in/dp/${asin.toUpperCase()}`;
      }
    } else if (host.includes('meesho.')) {
      // Meesho link can be of form /s/p/XXXXX or /p/XXXXX
      // Strip any query parameters
      url.search = '';
      return url.toString().toLowerCase().trim();
    }

    // Fallback for general URLs
    url.search = '';
    return url.toString().toLowerCase().trim();
  } catch {
    return urlStr.toLowerCase().trim();
  }
}

/**
 * Validates that a string is a valid URL
 */
export function isValidUrl(urlStr: string): boolean {
  try {
    new URL(urlStr);
    return true;
  } catch {
    return false;
  }
}
