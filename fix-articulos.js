/**
 * Fix Articulos Migration
 * The author/category fields need integer IDs, not UUIDs
 */

const fs = require('fs').promises;
const fsSync = require('fs');

const DIRECTUS_URL = 'http://localhost:8056';
const TOKEN = fsSync.readFileSync('/tmp/directus_token.txt', 'utf8').trim();

// ID mapping from the migration
const idMap = JSON.parse(fsSync.readFileSync('./webflow-backup/id-mapping.json', 'utf8'));

async function api(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${DIRECTUS_URL}${endpoint}`, options);
  return res.json();
}

async function main() {
  console.log('Fixing Articulos Migration\n');

  // Load articulos from Webflow backup
  const articulos = JSON.parse(await fs.readFile('./webflow-backup/collections/articulos.json', 'utf8'));

  let success = 0;
  let failed = 0;

  for (const item of articulos) {
    const fd = item.fieldData || {};

    // Get the Directus integer IDs
    const webflowAuthorId = fd['author-4'];
    const webflowCategoryId = fd['category-5'];

    // Look up in our ID map to get Directus IDs
    const authorId = webflowAuthorId ? idMap.autores[webflowAuthorId] : null;
    const categoryId = webflowCategoryId ? idMap.categorias[webflowCategoryId] : null;

    const data = {
      title: fd.title || fd.name || 'Unknown',
      name: fd.name || fd.title || 'Unknown',
      slug: fd.slug || item.slug,
      intro_text: fd.text || '',
      content: fd['post-content'] || '',
      // Use integer IDs directly
      author: authorId || null,
      category: categoryId || null,
    };

    try {
      const result = await api('/items/articulos', 'POST', data);
      if (result.data) {
        success++;
        console.log(`✓ ${data.title}`);
      } else {
        failed++;
        console.log(`✗ ${data.title}: ${JSON.stringify(result.errors?.[0]?.message || result)}`);
      }
    } catch (e) {
      failed++;
      console.log(`✗ ${data.title}: ${e.message}`);
    }
  }

  console.log(`\nComplete: ${success} success, ${failed} failed`);
}

main().catch(console.error);
