import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface PropertyData {
  listing_id: string;
  url: string;
  title: string;
  details_table: {
    Type: string;
    Price: string;
    "Bath(s)": string;
    Area: string;
    Purpose: string;
    "Bedroom(s)": string;
    Added: string;
    Location: string;
  };
  amenities: Record<string, { items: string[] }>;
  description: string;
  agent: { agency: string; person: string };
  badges: { trusted: boolean; titanium: boolean; premium: boolean };
  images: string[];
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const listingId = extractListingId(url);
    if (!listingId) {
      return new Response(JSON.stringify({ error: "Could not extract listing ID from URL" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch page: HTTP ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const html = await resp.text();

    const jsonld = extractJsonLd(html).find(b =>
      b["@type"] === "Product" || b["@type"] === "ApartmentComplex" || b["@type"] === "RealEstateListing"
    ) || {};

    const title = extractTitle(html) || (jsonld.name as string) || "";
    const description = extractDescription(html) || (jsonld.description as string) || "";
    const detailsTable = extractDetailsTable(html);
    const agent = extractAgent(html);
    const badges = extractBadges(html);
    const images = extractImages(html);
    const amenities = extractAmenities(html);

    const property: PropertyData = {
      listing_id: listingId,
      url,
      title,
      details_table: detailsTable,
      amenities,
      description,
      agent,
      badges,
      images,
    };

    const society = extractSociety(detailsTable.Location);

    // Save to Supabase for future comparables
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await sb.from("properties").upsert(
        { listing_id: listingId, data: property },
        { onConflict: "listing_id" }
      );
    } catch {
      // non-fatal
    }

    return new Response(JSON.stringify({ property, society }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});

/* ── Helpers ── */

function extractListingId(url: string): string | null {
  const m = url.match(/-(\d+)-\d+-\d+\.html$/);
  return m ? m[1] : null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) out.push(...p); else out.push(p);
    } catch { /* skip */ }
  }
  return out;
}

function extractTitle(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]*>/g, "").trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  return t ? t[1].replace(/<[^>]*>/g, "").trim().replace(/\s*\|.*$/, "").trim() : "";
}

function extractDescription(html: string): string {
  const md = html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (md) return md[1];
  const ds = html.match(/<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  return ds ? ds[1].replace(/<[^>]*>/g, "").trim() : "";
}

function extractDetailsTable(html: string): PropertyData["details_table"] {
  const out: PropertyData["details_table"] = {
    Type: "House", Price: "", "Bath(s)": "", Area: "",
    Purpose: "For Sale", "Bedroom(s)": "", Added: "", Location: "",
  };
  const block = html.match(
    /<div[^>]*class=["'][^"']*_1db9d[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
  ) || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  const section = block ? block[0] : html;

  const f = (label: string) => {
    const re = [
      new RegExp(`${label}[\\s\\S]*?<span[^>]*>([^<]+)<\/span>`, "i"),
      new RegExp(`${label}[^<]*<[^>]*>([^<]*(?:Crore|Lakh|Marla|Kanal|House|Flat|Plot|For Sale|For Rent|hours? ago|days? ago|weeks? ago|months? ago)[^<]*)`, "i"),
      new RegExp(`${label}[\\s:]*([^<]*)`, "i"),
    ];
    for (const r of re) {
      const m = section.match(r);
      if (m) { const v = m[1].trim(); if (v && v.length < 200) return v; }
    }
    return "";
  };

  const t = f("Type"); if (t) out.Type = t;
  const p = f("Price"); if (p) out.Price = p;
  const ba = f("Bath"); if (ba) out["Bath(s)"] = ba;
  const a = f("Area"); if (a) out.Area = a;
  const pu = f("Purpose"); if (pu) out.Purpose = pu;
  const be = f("Bedroom"); if (be) out["Bedroom(s)"] = be;
  const ad = f("Added"); if (ad) out.Added = ad;
  const l = f("Location"); if (l) out.Location = l;

  if (!out.Price) {
    const pm = html.match(/PKR\s*[\d,]+\s*(Crore|Lakh)?/i);
    if (pm) out.Price = pm[0];
  }
  return out;
}

function extractAmenities(html: string): Record<string, { items: string[] }> {
  const list = [
    "Bedrooms", "Bathrooms", "Kitchens", "Parking", "Floors",
    "Furnished", "Central Air Conditioning", "Central Heating",
    "Double Glazed Windows", "Flooring", "Electricity Backup",
    "Drawing Room", "Dining Room", "Study Room", "Prayer Room",
    "Lounge", "Laundry", "Gym", "Swimming Pool", "Garden",
    "Mosque", "Kids Play Area", "Security", "Maintenance",
  ];
  const found = list.filter(a => html.toLowerCase().includes(a.toLowerCase()));
  return found.length ? { Features: { items: found } } : {};
}

function extractAgent(html: string): { agency: string; person: string } {
  let person = "", agency = "";
  const pm = html.match(/<div[^>]*class=["'][^"']*agent-name[^"']*["'][^>]*>([^<]+)/i);
  if (pm) person = pm[1].trim();
  const am = html.match(/<div[^>]*class=["'][^"']*agency-name[^"']*["'][^>]*>([^<]+)/i)
         || html.match(/by\s+([A-Z][A-Za-z\s]+?(?:Real Estate|Properties|Realtors|Estate|Homes))/i);
  if (am) agency = am[1].trim();
  if (!person) {
    const ma = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)/i);
    if (ma) person = ma[1];
  }
  return { agency: agency || "Zameen Agent", person: person || "Zameen Agent" };
}

function extractBadges(html: string): { trusted: boolean; titanium: boolean; premium: boolean } {
  let trusted = false, titanium = false, premium = false;

  // Only trust badge indicators inside visible <span> elements
  // NOT generic keyword matches (which cause false positives)
  const agentZone = html.match(
    /<div[^>]*class=["'][^"']*(?:agent|seller|contact-person|_contact)[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>\s*){2,5}/i
  );
  const zone = agentZone ? agentZone[0] : html;

  // Check for visible badge text in the agent zone only
  const spans = zone.matchAll(/<span[^>]*>\s*(Trusted|Titanium|Premium)\s*<\/span>/gi);
  for (const s of spans) {
    const word = s[1].toLowerCase();
    if (word === "trusted") trusted = true;
    if (word === "titanium") titanium = true;
    if (word === "premium") premium = true;
  }
  // Also check <img> alt attributes for badges
  if (!trusted && zone.match(/<img[^>]*alt=["']Trusted["']/i)) trusted = true;
  if (!titanium && zone.match(/<img[^>]*alt=["']Titanium["']/i)) titanium = true;
  if (!premium && zone.match(/<img[^>]*alt=["']Premium["']/i)) premium = true;

  return { trusted, titanium, premium };
}

function extractImages(html: string): string[] {
  const imgs: string[] = [];
  for (const block of extractJsonLd(html)) {
    const img = block.image;
    if (typeof img === "string" && img.includes("zameen.com") && !imgs.includes(img)) imgs.push(img);
    if (Array.isArray(img)) {
      for (const i of img) {
        if (typeof i === "string" && i.includes("zameen.com") && !imgs.includes(i)) imgs.push(i);
      }
    }
  }
  const re = /<img[^>]*src=["'](https:\/\/media\.zameen\.com[^"']*)["']/gi;
  let m; while ((m = re.exec(html)) !== null) { if (!imgs.includes(m[1])) imgs.push(m[1]); }
  return [...new Set(imgs)].slice(0, 50);
}

function extractSociety(location: string): string {
  return location.split(",")[0].trim();
}