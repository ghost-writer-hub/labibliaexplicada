const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.labibliaexplicada.com';
const BACKUP_DIR = './backup';
const CONCURRENCY = 3;
const DELAY_MS = 500;

// Template detection patterns
const TEMPLATES = {
  home: { pattern: /^\/$/, name: 'home' },
  article: { pattern: /^\/articulos\//, name: 'article' },
  book: { pattern: /^\/libro\//, name: 'book' },
  chapter: { pattern: /^\/capitulos\//, name: 'chapter' },
  category: { pattern: /^\/categoria\//, name: 'category' },
  concept: { pattern: /^\/conceptos\//, name: 'concept' },
  author: { pattern: /^\/autores\//, name: 'author' },
  static: { pattern: /^\/(sobre-nosotros|search|libros-de-la-biblia|lecturas-de-hoy|conceptos-biblicos|articulos-recientes|personajes)$/, name: 'static' }
};

function getTemplateType(urlPath) {
  for (const [key, { pattern, name }] of Object.entries(TEMPLATES)) {
    if (pattern.test(urlPath)) return name;
  }
  return 'unknown';
}

function sanitizePath(urlPath) {
  return urlPath.replace(/[^a-zA-Z0-9\-\/]/g, '_').replace(/^\//, '') || 'index';
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function downloadAsset(browser, url, localPath) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      await fs.writeFile(localPath, Buffer.from(buffer));
      return true;
    }
  } catch (e) {
    console.error(`Failed to download asset: ${url}`);
  }
  return false;
}

async function extractPageData(page, url) {
  const html = await page.content();
  const $ = cheerio.load(html);

  // Remove scripts and styles for clean content
  $('script, style, noscript').remove();

  // Extract metadata
  const metadata = {
    url,
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    canonical: $('link[rel="canonical"]').attr('href') || '',
  };

  // Extract main content areas
  const mainContent = $('main').html() || $('[role="main"]').html() || $('article').html() || $('body').html();

  // Extract navigation structure
  const navigation = [];
  $('nav a, header a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && text) navigation.push({ href, text });
  });

  // Extract all images
  const images = [];
  $('img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    const alt = $(el).attr('alt') || '';
    if (src) images.push({ src, alt });
  });

  // Extract structured content based on template type
  const urlPath = new URL(url).pathname;
  const templateType = getTemplateType(urlPath);

  let structuredContent = {};

  if (templateType === 'article') {
    structuredContent = {
      headline: $('h1').first().text().trim(),
      author: $('[class*="author"], [rel="author"]').text().trim(),
      date: $('time').attr('datetime') || $('[class*="date"]').text().trim(),
      categories: $('[class*="category"] a, [class*="tag"] a').map((i, el) => $(el).text().trim()).get(),
      body: $('article').text().trim() || mainContent,
    };
  } else if (templateType === 'book') {
    structuredContent = {
      bookName: $('h1').first().text().trim(),
      description: $('[class*="description"], [class*="intro"]').text().trim(),
      chapters: $('[class*="chapter"] a, [class*="capitulo"] a').map((i, el) => ({
        href: $(el).attr('href'),
        text: $(el).text().trim()
      })).get(),
    };
  } else if (templateType === 'chapter') {
    structuredContent = {
      chapterTitle: $('h1').first().text().trim(),
      bookReference: $('[class*="book-ref"], [class*="libro"]').text().trim(),
      verseContent: $('[class*="verse"], [class*="content"], article').text().trim(),
      previousChapter: $('a[href*="capitulos"][class*="prev"], a[rel="prev"]').attr('href'),
      nextChapter: $('a[href*="capitulos"][class*="next"], a[rel="next"]').attr('href'),
    };
  }

  // Extract CSS classes for template analysis
  const bodyClasses = $('body').attr('class') || '';
  const mainClasses = $('main').attr('class') || '';

  return {
    metadata,
    templateType,
    templateClasses: { body: bodyClasses, main: mainClasses },
    navigation: navigation.slice(0, 20), // Limit to avoid duplication
    images,
    structuredContent,
    rawHtml: html,
    cleanText: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000),
  };
}

async function crawlPage(page, url, stats) {
  const urlPath = new URL(url).pathname;
  const templateType = getTemplateType(urlPath);
  const safePath = sanitizePath(urlPath);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const pageData = await extractPageData(page, url);

    // Save HTML
    const htmlDir = path.join(BACKUP_DIR, 'pages', templateType);
    await ensureDir(htmlDir);
    await fs.writeFile(
      path.join(htmlDir, `${safePath.replace(/\//g, '_')}.html`),
      pageData.rawHtml
    );

    // Save structured data
    const dataDir = path.join(BACKUP_DIR, 'data', templateType);
    await ensureDir(dataDir);
    const { rawHtml, ...dataWithoutHtml } = pageData;
    await fs.writeFile(
      path.join(dataDir, `${safePath.replace(/\//g, '_')}.json`),
      JSON.stringify(dataWithoutHtml, null, 2)
    );

    stats.success++;
    stats.byTemplate[templateType] = (stats.byTemplate[templateType] || 0) + 1;

    console.log(`[${stats.success}/${stats.total}] ✓ ${urlPath} (${templateType})`);

    return pageData;
  } catch (error) {
    stats.failed++;
    stats.errors.push({ url, error: error.message });
    console.error(`[ERROR] ${urlPath}: ${error.message}`);
    return null;
  }
}

async function crawlBatch(browser, urls, stats) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 LBE-Backup-Bot/1.0'
  });

  const page = await context.newPage();
  const results = [];

  for (const url of urls) {
    const result = await crawlPage(page, url, stats);
    results.push(result);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await context.close();
  return results;
}

async function analyzeTemplates(dataDir) {
  const templates = {};
  const templateDirs = await fs.readdir(path.join(dataDir, 'data')).catch(() => []);

  for (const dir of templateDirs) {
    const files = await fs.readdir(path.join(dataDir, 'data', dir)).catch(() => []);
    templates[dir] = {
      count: files.length,
      samples: [],
      commonClasses: new Set(),
    };

    // Analyze first 5 samples
    for (const file of files.slice(0, 5)) {
      try {
        const content = await fs.readFile(path.join(dataDir, 'data', dir, file), 'utf8');
        const data = JSON.parse(content);
        templates[dir].samples.push({
          url: data.metadata.url,
          title: data.metadata.title,
          classes: data.templateClasses,
        });
        if (data.templateClasses.body) {
          data.templateClasses.body.split(' ').forEach(c => templates[dir].commonClasses.add(c));
        }
      } catch (e) {}
    }

    templates[dir].commonClasses = Array.from(templates[dir].commonClasses);
  }

  return templates;
}

async function collectAssets(dataDir) {
  const assets = new Set();
  const templateDirs = await fs.readdir(path.join(dataDir, 'data')).catch(() => []);

  for (const dir of templateDirs) {
    const files = await fs.readdir(path.join(dataDir, 'data', dir)).catch(() => []);
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(dataDir, 'data', dir, file), 'utf8');
        const data = JSON.parse(content);
        data.images.forEach(img => {
          if (img.src && img.src.startsWith('http')) assets.add(img.src);
        });
        if (data.metadata.ogImage) assets.add(data.metadata.ogImage);
      } catch (e) {}
    }
  }

  return Array.from(assets);
}

async function main() {
  console.log('='.repeat(60));
  console.log('La Biblia Explicada - Full Site Backup');
  console.log('='.repeat(60));

  // Load URLs
  const urlsContent = await fs.readFile('./backup/data/urls.txt', 'utf8');
  const urls = urlsContent.trim().split('\n').filter(u => u.trim());

  console.log(`\nFound ${urls.length} URLs to crawl\n`);

  const stats = {
    total: urls.length,
    success: 0,
    failed: 0,
    byTemplate: {},
    errors: [],
    startTime: new Date(),
  };

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  // Split URLs into batches for parallel processing
  const batchSize = Math.ceil(urls.length / CONCURRENCY);
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  console.log(`Processing in ${batches.length} parallel batches...\n`);

  // Process batches in parallel
  await Promise.all(batches.map(batch => crawlBatch(browser, batch, stats)));

  await browser.close();

  // Analyze templates
  console.log('\n' + '='.repeat(60));
  console.log('Analyzing templates...');
  const templateAnalysis = await analyzeTemplates(BACKUP_DIR);
  await fs.writeFile(
    path.join(BACKUP_DIR, 'templates', 'analysis.json'),
    JSON.stringify(templateAnalysis, null, 2)
  );

  // Collect assets
  console.log('Collecting asset URLs...');
  const assets = await collectAssets(BACKUP_DIR);
  await fs.writeFile(
    path.join(BACKUP_DIR, 'assets', 'asset-urls.json'),
    JSON.stringify(assets, null, 2)
  );

  // Save final stats
  stats.endTime = new Date();
  stats.duration = (stats.endTime - stats.startTime) / 1000;
  await fs.writeFile(
    path.join(BACKUP_DIR, 'data', 'crawl-stats.json'),
    JSON.stringify(stats, null, 2)
  );

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('CRAWL COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total URLs: ${stats.total}`);
  console.log(`Success: ${stats.success}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Duration: ${stats.duration.toFixed(1)}s`);
  console.log('\nBy Template Type:');
  Object.entries(stats.byTemplate).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log(`\nAssets found: ${assets.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  ${e.url}: ${e.error}`));
    if (stats.errors.length > 10) console.log(`  ... and ${stats.errors.length - 10} more`);
  }
}

main().catch(console.error);
