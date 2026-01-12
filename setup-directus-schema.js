/**
 * Setup Directus Schema
 * Creates all collections and fields needed for La Biblia Explicada
 */

const fs = require('fs');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8056';
const TOKEN = process.env.DIRECTUS_TOKEN || fs.readFileSync('/tmp/directus_token.txt', 'utf8').trim();

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
  const data = await res.json();

  if (!res.ok) {
    console.error(`API Error: ${endpoint}`, data);
    return null;
  }
  return data;
}

async function createCollection(name, meta = {}) {
  console.log(`Creating collection: ${name}`);
  const result = await api('/collections', 'POST', {
    collection: name,
    schema: { name },
    meta: { icon: meta.icon || 'folder', ...meta },
  });
  return result !== null;
}

async function createField(collection, field) {
  console.log(`  Adding field: ${field.field}`);
  const result = await api(`/fields/${collection}`, 'POST', field);
  return result !== null;
}

async function main() {
  console.log('='.repeat(50));
  console.log('Setting up Directus Schema');
  console.log('='.repeat(50));

  // 1. Autores
  await createCollection('autores', { icon: 'person', singleton: false });
  await createField('autores', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('autores', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('autores', { field: 'bio', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('autores', { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });

  // 2. Categorias
  await createCollection('categorias', { icon: 'category' });
  await createField('categorias', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('categorias', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });

  // 3. Libros
  await createCollection('libros', { icon: 'menu_book' });
  await createField('libros', { field: 'book_id', type: 'integer', meta: { required: true, interface: 'input' } });
  await createField('libros', { field: 'title', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('libros', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('libros', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('libros', { field: 'testament', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Antiguo', value: 'antiguo' }, { text: 'Nuevo', value: 'nuevo' }] } } });
  await createField('libros', { field: 'details', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('libros', { field: 'explanation', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('libros', { field: 'faqs', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('libros', { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });
  await createField('libros', { field: 'image_alt', type: 'string', meta: { interface: 'input' } });

  // 4. Capitulos
  await createCollection('capitulos', { icon: 'article' });
  await createField('capitulos', { field: 'libro', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'libros' } });
  await createField('capitulos', { field: 'chapter_id', type: 'integer', meta: { required: true, interface: 'input' } });
  await createField('capitulos', { field: 'chapter_global_id', type: 'integer', meta: { interface: 'input' } });
  await createField('capitulos', { field: 'chapter_title', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('capitulos', { field: 'chapter_title_list', type: 'string', meta: { interface: 'input' } });
  await createField('capitulos', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('capitulos', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('capitulos', { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('capitulos', { field: 'explanation', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('capitulos', { field: 'chapter_summary', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('capitulos', { field: 'chapter_day', type: 'integer', meta: { interface: 'input' } });
  await createField('capitulos', { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });
  await createField('capitulos', { field: 'image_alt', type: 'string', meta: { interface: 'input' } });
  await createField('capitulos', { field: 'json_ld', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } });

  // 5. Articulos
  await createCollection('articulos', { icon: 'description' });
  await createField('articulos', { field: 'title', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('articulos', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('articulos', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('articulos', { field: 'intro_text', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('articulos', { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('articulos', { field: 'thumbnail', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });
  await createField('articulos', { field: 'header_image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });
  await createField('articulos', { field: 'author', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'autores' } });
  await createField('articulos', { field: 'category', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'categorias' } });

  // 6. Conceptos
  await createCollection('conceptos', { icon: 'lightbulb' });
  await createField('conceptos', { field: 'title', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('conceptos', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('conceptos', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('conceptos', { field: 'intro_text', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('conceptos', { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('conceptos', { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });

  // 7. Personajes
  await createCollection('personajes', { icon: 'face' });
  await createField('personajes', { field: 'name', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('personajes', { field: 'slug', type: 'string', meta: { required: true, interface: 'input' } });
  await createField('personajes', { field: 'description', type: 'text', meta: { interface: 'input-multiline' } });
  await createField('personajes', { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html' } });
  await createField('personajes', { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });

  // Create relations
  console.log('\nCreating relations...');
  await api('/relations', 'POST', {
    collection: 'capitulos',
    field: 'libro',
    related_collection: 'libros',
    meta: { one_field: 'capitulos' }
  });
  await api('/relations', 'POST', {
    collection: 'articulos',
    field: 'author',
    related_collection: 'autores'
  });
  await api('/relations', 'POST', {
    collection: 'articulos',
    field: 'category',
    related_collection: 'categorias'
  });

  console.log('\n' + '='.repeat(50));
  console.log('Schema setup complete!');
  console.log('='.repeat(50));
}

main().catch(console.error);
