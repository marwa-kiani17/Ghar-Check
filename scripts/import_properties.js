/**
 * Script to import new property listings into:
 * 1. src/data/properties.json (append to existing)
 * 2. Supabase properties table
 *
 * Usage: node scripts/import_properties.js
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://atywnmldzhwniguvinpa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eXdubWxkemh3bmlndXZpbnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjQyMzEsImV4cCI6MjEwMTg0MDIzMX0.rssSR4bo7alDqzlkU2sjU9eV6Cz5yIaS2M5F2_QEbrA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Load existing properties from JSON
const propertiesPath = path.join(__dirname, '..', 'src', 'data', 'properties.json');
const existingProperties = JSON.parse(fs.readFileSync(propertiesPath, 'utf-8'));
const existingIds = new Set(existingProperties.map(p => p.listing_id));

// Load new properties from separate file
const newPropertiesPath = path.join(__dirname, '..', 'src', 'data', 'new_properties.json');
const newProperties = JSON.parse(fs.readFileSync(newPropertiesPath, 'utf-8'));

// Filter out any that already exist
const uniqueNew = newProperties.filter(p => !existingIds.has(p.listing_id));

console.log(`Existing: ${existingProperties.length} properties`);
console.log(`New (unique): ${uniqueNew.length} properties`);

// 1. Write merged JSON
const merged = [...existingProperties, ...uniqueNew];
fs.writeFileSync(propertiesPath, JSON.stringify(merged, null, 2), 'utf-8');
console.log('✅ Updated properties.json');

// 2. Insert into Supabase
async function insertIntoDB() {
  const rows = uniqueNew.map(p => ({
    listing_id: p.listing_id,
    data: p
  }));

  // Insert in batches to avoid payload size limits
  const batchSize = 10;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('properties')
      .upsert(batch, { onConflict: 'listing_id' });

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ Inserted batch ${i / batchSize + 1}: ${batch.length} rows`);
    }
  }

  console.log(`\nDone! ${inserted} new properties added to DB.`);
}

insertIntoDB();