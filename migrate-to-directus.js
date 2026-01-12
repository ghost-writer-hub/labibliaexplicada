/**
 * Migration Script: Webflow to Directus
 *
 * This script imports all CMS data from the Webflow backup into Directus.
 *
 * Usage:
 * 1. Start Directus: docker-compose up -d
 * 2. Wait for Directus to be ready
 * 3. Run: DIRECTUS_URL=http://localhost:8055 DIRECTUS_TOKEN=your-admin-token node migrate-to-directus.js
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8056';
let DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const WEBFLOW_BACKUP_DIR = './webflow-backup';

// Try to read token from file if not in env
if (!DIRECTUS_TOKEN) {
  try {
    DIRECTUS_TOKEN = fsSync.readFileSync('/tmp/directus_token.txt', 'utf8').trim();
  } catch (e) {
    console.error('Error: DIRECTUS_TOKEN environment variable is required');
    console.log('Get a static token from Directus Admin > Settings > Access Tokens');
    process.exit(1);
  }
}

// Mapping of Webflow IDs to Directus UUIDs
const idMap = {
  autores: {},
  categorias: {},
  libros: {},
  capitulos: {},
  articulos: {},
  conceptos: {},
  personajes: {},
};

async function directusRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${DIRECTUS_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Directus API error: ${JSON.stringify(data)}`);
  }

  return data;
}

async function loadWebflowData(collection) {
  const filePath = path.join(WEBFLOW_BACKUP_DIR, 'collections', `${collection}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.log(`No data found for ${collection}`);
    return [];
  }
}

async function createCollection(name, schema) {
  try {
    await directusRequest('/collections', 'POST', {
      collection: name,
      schema: { name },
      meta: schema.meta,
    });
    console.log(`Created collection: ${name}`);

    // Create fields
    for (const field of schema.fields) {
      if (field.field === 'id') continue; // Skip primary key
      try {
        await directusRequest(`/fields/${name}`, 'POST', field);
        console.log(`  Created field: ${field.field}`);
      } catch (e) {
        console.log(`  Field ${field.field} may already exist`);
      }
    }
  } catch (e) {
    console.log(`Collection ${name} may already exist`);
  }
}

async function migrateAutores() {
  console.log('\n=== Migrating Autores ===');
  const items = await loadWebflowData('autores');

  for (const item of items) {
    const data = {
      name: item.fieldData?.name || item.fieldData?.['name'] || 'Unknown',
      slug: item.fieldData?.slug || item.slug,
      bio: item.fieldData?.bio || '',
    };

    try {
      const result = await directusRequest('/items/autores', 'POST', data);
      idMap.autores[item.id || item._id] = result.data.id;
      console.log(`  Migrated autor: ${data.name}`);
    } catch (e) {
      console.error(`  Error migrating autor: ${e.message}`);
    }
  }
}

async function migrateCategorias() {
  console.log('\n=== Migrating Categorias ===');
  const items = await loadWebflowData('categoria');

  for (const item of items) {
    const data = {
      name: item.fieldData?.name || item.fieldData?.['name'] || 'Unknown',
      slug: item.fieldData?.slug || item.slug,
    };

    try {
      const result = await directusRequest('/items/categorias', 'POST', data);
      idMap.categorias[item.id || item._id] = result.data.id;
      console.log(`  Migrated categoria: ${data.name}`);
    } catch (e) {
      console.error(`  Error migrating categoria: ${e.message}`);
    }
  }
}

async function migrateLibros() {
  console.log('\n=== Migrating Libros ===');
  const items = await loadWebflowData('libro');

  for (const item of items) {
    const fd = item.fieldData || {};
    const data = {
      book_id: fd['book-id'] || fd.book_id || 0,
      title: fd.title || fd.name || 'Unknown',
      name: fd.name || fd.title || 'Unknown',
      slug: fd.slug || item.slug,
      testament: fd.testament || 'antiguo',
      details: fd.details || '',
      explanation: fd.explanation || '',
      faqs: fd.faqs || '',
      image_alt: fd['image-alt-description'] || '',
    };

    try {
      const result = await directusRequest('/items/libros', 'POST', data);
      idMap.libros[item.id || item._id] = result.data.id;
      console.log(`  Migrated libro: ${data.title}`);
    } catch (e) {
      console.error(`  Error migrating libro ${data.title}: ${e.message}`);
    }
  }
}

async function migrateCapitulos() {
  console.log('\n=== Migrating Capitulos ===');
  const items = await loadWebflowData('capitulos');

  let count = 0;
  for (const item of items) {
    const fd = item.fieldData || {};

    // Get the Directus libro ID from the Webflow libro reference
    const webflowLibroId = fd.libro || fd['libro'];
    const directusLibroId = webflowLibroId ? idMap.libros[webflowLibroId] : null;

    const data = {
      libro: directusLibroId,
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
      const result = await directusRequest('/items/capitulos', 'POST', data);
      idMap.capitulos[item.id || item._id] = result.data.id;
      count++;
      if (count % 100 === 0) {
        console.log(`  Migrated ${count} capitulos...`);
      }
    } catch (e) {
      console.error(`  Error migrating capitulo ${data.name}: ${e.message}`);
    }
  }
  console.log(`  Total migrated: ${count} capitulos`);
}

async function migrateArticulos() {
  console.log('\n=== Migrating Articulos ===');
  const items = await loadWebflowData('articulos');

  for (const item of items) {
    const fd = item.fieldData || {};

    const webflowAuthorId = fd['author-4'];
    const webflowCategoryId = fd['category-5'];

    const data = {
      title: fd.title || fd.name || 'Unknown',
      name: fd.name || fd.title || 'Unknown',
      slug: fd.slug || item.slug,
      intro_text: fd.text || '',
      content: fd['post-content'] || '',
      author: webflowAuthorId ? idMap.autores[webflowAuthorId] : null,
      category: webflowCategoryId ? idMap.categorias[webflowCategoryId] : null,
    };

    try {
      const result = await directusRequest('/items/articulos', 'POST', data);
      idMap.articulos[item.id || item._id] = result.data.id;
      console.log(`  Migrated articulo: ${data.title}`);
    } catch (e) {
      console.error(`  Error migrating articulo ${data.title}: ${e.message}`);
    }
  }
}

async function migrateConceptos() {
  console.log('\n=== Migrating Conceptos ===');
  const items = await loadWebflowData('conceptos');

  for (const item of items) {
    const fd = item.fieldData || {};
    const data = {
      title: fd.title || fd.name || 'Unknown',
      name: fd.name || fd.title || 'Unknown',
      slug: fd.slug || item.slug,
      intro_text: fd.text || fd['intro-text'] || '',
      content: fd.content || fd['post-content'] || '',
    };

    try {
      const result = await directusRequest('/items/conceptos', 'POST', data);
      idMap.conceptos[item.id || item._id] = result.data.id;
      console.log(`  Migrated concepto: ${data.title}`);
    } catch (e) {
      console.error(`  Error migrating concepto ${data.title}: ${e.message}`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Webflow to Directus Migration');
  console.log('='.repeat(60));
  console.log(`Directus URL: ${DIRECTUS_URL}`);
  console.log(`Backup Dir: ${WEBFLOW_BACKUP_DIR}`);

  // Test connection
  try {
    await directusRequest('/server/health');
    console.log('Connected to Directus successfully!\n');
  } catch (e) {
    console.error('Failed to connect to Directus:', e.message);
    process.exit(1);
  }

  // Migrate in order (respecting relationships)
  await migrateAutores();
  await migrateCategorias();
  await migrateLibros();
  await migrateCapitulos();
  await migrateArticulos();
  await migrateConceptos();

  // Save ID mapping for reference
  await fs.writeFile(
    path.join(WEBFLOW_BACKUP_DIR, 'id-mapping.json'),
    JSON.stringify(idMap, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log('\nID mapping saved to webflow-backup/id-mapping.json');
  console.log('\nNext steps:');
  console.log('1. Review data in Directus Admin: ' + DIRECTUS_URL);
  console.log('2. Upload images manually or via Directus API');
  console.log('3. Update Astro .env with DIRECTUS_URL');
  console.log('4. Run: cd astro-site && npm run build');
}

main().catch(console.error);
