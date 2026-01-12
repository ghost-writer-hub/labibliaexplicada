const fs = require('fs').promises;
const path = require('path');

const TOKEN = 'f261841d182de8c75460f91f60ede9896ed4fb8edc5da3a8226c9065fb92eaf3';
const SITE_ID = '66cc37c5e520d320590085ca';
const BACKUP_DIR = './webflow-backup';

async function apiCall(endpoint) {
  const response = await fetch(`https://api.webflow.com/v2${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function getAllItems(collectionId, collectionSlug) {
  let allItems = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await apiCall(`/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
    if (!data.items || data.items.length === 0) break;
    allItems = allItems.concat(data.items);
    console.log(`  Fetched ${allItems.length} items from ${collectionSlug}...`);
    if (data.items.length < limit) break;
    offset += limit;
    await new Promise(r => setTimeout(r, 200)); // Rate limiting
  }

  return allItems;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Webflow CMS Full Export');
  console.log('='.repeat(60));

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.mkdir(path.join(BACKUP_DIR, 'collections'), { recursive: true });
  await fs.mkdir(path.join(BACKUP_DIR, 'schemas'), { recursive: true });

  // Get site info
  console.log('\nFetching site info...');
  const sites = await apiCall('/sites');
  await fs.writeFile(path.join(BACKUP_DIR, 'sites.json'), JSON.stringify(sites, null, 2));

  // Get collections
  console.log('Fetching collections...');
  const collections = await apiCall(`/sites/${SITE_ID}/collections`);
  await fs.writeFile(path.join(BACKUP_DIR, 'collections-list.json'), JSON.stringify(collections, null, 2));

  const stats = { collections: {}, totalItems: 0 };

  // For each collection, get schema and all items
  for (const collection of collections.collections) {
    console.log(`\nProcessing collection: ${collection.displayName}`);

    // Get collection schema (fields)
    const schema = await apiCall(`/collections/${collection.id}`);
    await fs.writeFile(
      path.join(BACKUP_DIR, 'schemas', `${collection.slug}.json`),
      JSON.stringify(schema, null, 2)
    );
    console.log(`  Schema saved: ${schema.fields?.length || 0} fields`);

    // Get all items
    const items = await getAllItems(collection.id, collection.slug);
    await fs.writeFile(
      path.join(BACKUP_DIR, 'collections', `${collection.slug}.json`),
      JSON.stringify(items, null, 2)
    );

    stats.collections[collection.slug] = items.length;
    stats.totalItems += items.length;
    console.log(`  Saved ${items.length} items`);

    await new Promise(r => setTimeout(r, 300)); // Rate limiting between collections
  }

  // Get pages
  console.log('\nFetching pages...');
  const pages = await apiCall(`/sites/${SITE_ID}/pages`);
  await fs.writeFile(path.join(BACKUP_DIR, 'pages.json'), JSON.stringify(pages, null, 2));
  console.log(`  Found ${pages.pages?.length || 0} pages`);

  // Get assets
  console.log('\nFetching assets...');
  let allAssets = [];
  let offset = 0;
  while (true) {
    const assets = await apiCall(`/sites/${SITE_ID}/assets?limit=100&offset=${offset}`);
    if (!assets.assets || assets.assets.length === 0) break;
    allAssets = allAssets.concat(assets.assets);
    if (assets.assets.length < 100) break;
    offset += 100;
    await new Promise(r => setTimeout(r, 200));
  }
  await fs.writeFile(path.join(BACKUP_DIR, 'assets.json'), JSON.stringify(allAssets, null, 2));
  console.log(`  Found ${allAssets.length} assets`);

  // Save summary
  stats.pagesCount = pages.pages?.length || 0;
  stats.assetsCount = allAssets.length;
  stats.exportDate = new Date().toISOString();
  await fs.writeFile(path.join(BACKUP_DIR, 'export-summary.json'), JSON.stringify(stats, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('EXPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nTotal items: ${stats.totalItems}`);
  console.log('By collection:');
  Object.entries(stats.collections).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
  console.log(`\nPages: ${stats.pagesCount}`);
  console.log(`Assets: ${stats.assetsCount}`);
}

main().catch(console.error);
