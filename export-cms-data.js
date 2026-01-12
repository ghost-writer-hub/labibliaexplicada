const fs = require('fs').promises;
const path = require('path');

const BACKUP_DIR = './backup';
const EXPORT_DIR = './backup/cms-export';

async function loadJsonFiles(dir) {
  const items = [];
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf8');
          items.push(JSON.parse(content));
        } catch (e) {}
      }
    }
  } catch (e) {}
  return items;
}

function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop();
  } catch {
    return '';
  }
}

async function exportArticles(articles) {
  const cmsItems = articles.map((a, index) => ({
    _id: `article-${index}`,
    slug: extractSlug(a.metadata.url),
    url: a.metadata.url,
    title: a.structuredContent.headline || a.metadata.title,
    metaTitle: a.metadata.title,
    metaDescription: a.metadata.description,
    ogImage: a.metadata.ogImage,
    author: a.structuredContent.author || 'Unknown',
    publishDate: a.structuredContent.date || null,
    categories: a.structuredContent.categories || [],
    content: a.cleanText,
    images: a.images,
  }));

  await fs.writeFile(
    path.join(EXPORT_DIR, 'articles.json'),
    JSON.stringify(cmsItems, null, 2)
  );

  // Also create CSV for easy import
  const csvHeaders = ['slug', 'title', 'metaDescription', 'author', 'publishDate', 'categories', 'url'];
  const csvRows = cmsItems.map(item => [
    item.slug,
    `"${(item.title || '').replace(/"/g, '""')}"`,
    `"${(item.metaDescription || '').replace(/"/g, '""')}"`,
    `"${(item.author || '').replace(/"/g, '""')}"`,
    item.publishDate || '',
    `"${(item.categories || []).join(', ')}"`,
    item.url,
  ]);

  const csv = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');
  await fs.writeFile(path.join(EXPORT_DIR, 'articles.csv'), csv);

  return cmsItems.length;
}

async function exportBooks(books) {
  const cmsItems = books.map((b, index) => ({
    _id: `book-${index}`,
    slug: extractSlug(b.metadata.url),
    url: b.metadata.url,
    name: b.structuredContent.bookName || b.metadata.title,
    metaTitle: b.metadata.title,
    metaDescription: b.metadata.description,
    ogImage: b.metadata.ogImage,
    description: b.structuredContent.description,
    chapters: b.structuredContent.chapters || [],
    chapterCount: (b.structuredContent.chapters || []).length,
  }));

  await fs.writeFile(
    path.join(EXPORT_DIR, 'books.json'),
    JSON.stringify(cmsItems, null, 2)
  );

  return cmsItems.length;
}

async function exportChapters(chapters) {
  const cmsItems = chapters.map((c, index) => {
    const slug = extractSlug(c.metadata.url);
    const parts = slug.split('-');
    const chapterNum = parts.find(p => !isNaN(p)) || '';

    return {
      _id: `chapter-${index}`,
      slug,
      url: c.metadata.url,
      title: c.structuredContent.chapterTitle || c.metadata.title,
      metaTitle: c.metadata.title,
      metaDescription: c.metadata.description,
      ogImage: c.metadata.ogImage,
      bookSlug: c.structuredContent.bookReference || slug.replace(/-\d+.*/, ''),
      chapterNumber: chapterNum,
      content: c.structuredContent.verseContent || c.cleanText,
      previousChapter: c.structuredContent.previousChapter,
      nextChapter: c.structuredContent.nextChapter,
    };
  });

  await fs.writeFile(
    path.join(EXPORT_DIR, 'chapters.json'),
    JSON.stringify(cmsItems, null, 2)
  );

  return cmsItems.length;
}

async function exportCategories(categories) {
  const cmsItems = categories.map((c, index) => ({
    _id: `category-${index}`,
    slug: extractSlug(c.metadata.url),
    url: c.metadata.url,
    name: c.metadata.title.replace(' | La Biblia Explicada', ''),
    metaTitle: c.metadata.title,
    metaDescription: c.metadata.description,
    ogImage: c.metadata.ogImage,
  }));

  await fs.writeFile(
    path.join(EXPORT_DIR, 'categories.json'),
    JSON.stringify(cmsItems, null, 2)
  );

  return cmsItems.length;
}

async function exportStaticPages(statics) {
  const cmsItems = statics.map((s, index) => ({
    _id: `page-${index}`,
    slug: extractSlug(s.metadata.url) || 'home',
    url: s.metadata.url,
    title: s.metadata.title,
    metaDescription: s.metadata.description,
    ogImage: s.metadata.ogImage,
    content: s.cleanText,
    navigation: s.navigation,
  }));

  await fs.writeFile(
    path.join(EXPORT_DIR, 'static-pages.json'),
    JSON.stringify(cmsItems, null, 2)
  );

  return cmsItems.length;
}

async function createRelationshipMap(chapters, books) {
  const relationships = {
    bookToChapters: {},
    chapterToBook: {},
  };

  // Map chapters to books
  chapters.forEach(c => {
    const slug = extractSlug(c.metadata.url);
    const bookSlug = slug.replace(/-\d+.*/, '');

    if (!relationships.bookToChapters[bookSlug]) {
      relationships.bookToChapters[bookSlug] = [];
    }
    relationships.bookToChapters[bookSlug].push(slug);
    relationships.chapterToBook[slug] = bookSlug;
  });

  await fs.writeFile(
    path.join(EXPORT_DIR, 'relationships.json'),
    JSON.stringify(relationships, null, 2)
  );

  return relationships;
}

async function main() {
  console.log('CMS Data Export for La Biblia Explicada\n');
  console.log('='.repeat(50));

  await fs.mkdir(EXPORT_DIR, { recursive: true });

  // Load all crawled data
  const dataDir = path.join(BACKUP_DIR, 'data');

  const articles = await loadJsonFiles(path.join(dataDir, 'article'));
  const books = await loadJsonFiles(path.join(dataDir, 'book'));
  const chapters = await loadJsonFiles(path.join(dataDir, 'chapter'));
  const categories = await loadJsonFiles(path.join(dataDir, 'category'));
  const statics = await loadJsonFiles(path.join(dataDir, 'static'));
  const home = await loadJsonFiles(path.join(dataDir, 'home'));

  console.log('\nData loaded:');
  console.log(`  Articles: ${articles.length}`);
  console.log(`  Books: ${books.length}`);
  console.log(`  Chapters: ${chapters.length}`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Static pages: ${statics.length + home.length}`);

  if (articles.length + books.length + chapters.length === 0) {
    console.log('\nNo data found. Run crawler.js first and wait for completion.');
    process.exit(0);
  }

  // Export each collection type
  console.log('\nExporting...');

  const articleCount = await exportArticles(articles);
  console.log(`  Exported ${articleCount} articles`);

  const bookCount = await exportBooks(books);
  console.log(`  Exported ${bookCount} books`);

  const chapterCount = await exportChapters(chapters);
  console.log(`  Exported ${chapterCount} chapters`);

  const categoryCount = await exportCategories(categories);
  console.log(`  Exported ${categoryCount} categories`);

  const staticCount = await exportStaticPages([...statics, ...home]);
  console.log(`  Exported ${staticCount} static pages`);

  // Create relationship map
  const relationships = await createRelationshipMap(chapters, books);
  console.log(`  Created relationship map (${Object.keys(relationships.bookToChapters).length} books)`);

  // Create summary
  const summary = {
    exportDate: new Date().toISOString(),
    collections: {
      articles: articleCount,
      books: bookCount,
      chapters: chapterCount,
      categories: categoryCount,
      staticPages: staticCount,
    },
    totalItems: articleCount + bookCount + chapterCount + categoryCount + staticCount,
    bookChapterRelationships: Object.keys(relationships.bookToChapters).length,
  };

  await fs.writeFile(
    path.join(EXPORT_DIR, 'export-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n' + '='.repeat(50));
  console.log('EXPORT COMPLETE');
  console.log('='.repeat(50));
  console.log(`\nTotal items exported: ${summary.totalItems}`);
  console.log(`\nFiles saved to: ${EXPORT_DIR}/`);
  console.log('  - articles.json / articles.csv');
  console.log('  - books.json');
  console.log('  - chapters.json');
  console.log('  - categories.json');
  console.log('  - static-pages.json');
  console.log('  - relationships.json');
  console.log('  - export-summary.json');
}

main().catch(console.error);
