const fs = require('fs');
const path = require('path');

const existingPath = path.join(__dirname, '..', 'src', 'data', 'properties.json');
const newPath = path.join(__dirname, '..', 'src', 'data', 'new_properties.json');

const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
const newData = JSON.parse(fs.readFileSync(newPath, 'utf-8'));

// Build a map of existing listing_ids
const idMap = new Map();
existing.forEach(p => idMap.set(p.listing_id, p));

// Merge: new data overwrites existing entries with same listing_id
let added = 0;
let skipped = 0;
newData.forEach(p => {
  if (idMap.has(p.listing_id)) {
    // Overwrite with newer data
    idMap.set(p.listing_id, p);
    skipped++;
  } else {
    idMap.set(p.listing_id, p);
    added++;
  }
});

const merged = Array.from(idMap.values());

fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2), 'utf-8');
console.log(`✅ Merged: ${existing.length} existing + ${newData.length} new = ${merged.length} total`);
console.log(`   - ${added} new listings added`);
console.log(`   - ${skipped} existing listings updated with newer data`);