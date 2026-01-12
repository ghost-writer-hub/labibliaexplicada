/**
 * Fix Capitulos Migration
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
  console.log('Importing Capitulos\n');

  // Load capitulos from Webflow backup
  const capitulos = JSON.parse(await fs.readFile('./webflow-backup/collections/capitulos.json', 'utf8'));

  let success = 0;
  let failed = 0;

  for (const item of capitulos) {
    const fd = item.fieldData || {};

    // Get the Directus integer ID for the libro
    const webflowLibroId = fd.libro || fd['libro'];
    const libroId = webflowLibroId ? idMap.libros[webflowLibroId] : null;

    const data = {
      libro: libroId || null,
      chapter_id: fd['numero-de-versiculo'] || fd.chapter_id || 0,
      chapter_global_id: fd['chapter-global-id'] || null,
      chapter_title: fd['nombre-del-versiculo'] || fd.chapter_title || '',
      chapter_title_list: fd['chapter-title-list'] || '',
      name: fd.name || '',
      slug: fd.slug || item.slug,
      content: fd.contenido || fd.content || '',
      explanation: fd.explicacion || fd.explanation || '',
      chapter_summary: fd['chapter-summary'] || '',
      chapter_day: fd['chapter-day'] || null,
      image_alt: fd['chapter-image-alt-text'] || '',
    };

    // Parse JSON-LD if present
    if (fd['json-ld-plain']) {
      try {
        data.json_ld = JSON.parse(fd['json-ld-plain']);
      } catch (e) {}
    }

    try {
      const result = await api('/items/capitulos', 'POST', data);
      if (result.data) {
        success++;
        if (success % 100 === 0) {
          console.log(`Progress: ${success} capitulos imported...`);
        }
      } else {
        failed++;
        if (failed <= 5) {
          console.log(`✗ ${data.name}: ${JSON.stringify(result.errors?.[0]?.message || result).slice(0, 100)}`);
        }
      }
    } catch (e) {
      failed++;
    }
  }

  console.log(`\nComplete: ${success} success, ${failed} failed`);
}

main().catch(console.error);
