const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const BACKUP_DIR = './backup';

// Webflow-specific class patterns
const WEBFLOW_PATTERNS = {
  container: /w-container|container-\d+/,
  grid: /w-layout-grid|w-grid/,
  column: /w-col|w-row/,
  richText: /w-richtext/,
  dyn: /w-dyn-|w-dyn-item|w-dyn-list/,
  nav: /w-nav|w-dropdown|w-nav-menu/,
  form: /w-form|w-input|w-button/,
  image: /w-image|w-background-video/,
  embed: /w-embed|w-iframe/,
  slider: /w-slider/,
  tabs: /w-tabs|w-tab-/,
};

async function analyzeHtmlFile(filePath) {
  const html = await fs.readFile(filePath, 'utf8');
  const $ = cheerio.load(html);

  const analysis = {
    file: path.basename(filePath),
    webflowClasses: {},
    customClasses: [],
    structure: {
      hasHeader: $('header').length > 0,
      hasNav: $('nav, [class*="nav"]').length > 0,
      hasMain: $('main, [role="main"]').length > 0,
      hasFooter: $('footer').length > 0,
      hasSidebar: $('[class*="sidebar"]').length > 0,
    },
    sections: [],
    collections: [],
    components: [],
  };

  // Collect all classes
  const allClasses = new Set();
  $('[class]').each((i, el) => {
    const classes = $(el).attr('class').split(/\s+/);
    classes.forEach(c => allClasses.add(c));
  });

  // Categorize classes
  allClasses.forEach(className => {
    let isWebflow = false;
    for (const [type, pattern] of Object.entries(WEBFLOW_PATTERNS)) {
      if (pattern.test(className)) {
        if (!analysis.webflowClasses[type]) analysis.webflowClasses[type] = [];
        analysis.webflowClasses[type].push(className);
        isWebflow = true;
        break;
      }
    }
    if (!isWebflow && className.length > 2) {
      analysis.customClasses.push(className);
    }
  });

  // Identify sections
  $('section, [class*="section"]').each((i, el) => {
    const sectionClass = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    analysis.sections.push({
      index: i,
      id,
      classes: sectionClass,
      tagName: el.tagName,
      childCount: $(el).children().length,
    });
  });

  // Identify dynamic collections (Webflow CMS)
  $('[class*="w-dyn"], [class*="collection"]').each((i, el) => {
    analysis.collections.push({
      classes: $(el).attr('class'),
      itemCount: $(el).find('[class*="w-dyn-item"], [class*="collection-item"]').length,
    });
  });

  // Identify reusable components
  const componentPatterns = [
    { selector: '[class*="card"]', type: 'card' },
    { selector: '[class*="hero"]', type: 'hero' },
    { selector: '[class*="cta"]', type: 'cta' },
    { selector: '[class*="testimonial"]', type: 'testimonial' },
    { selector: '[class*="feature"]', type: 'feature' },
    { selector: '[class*="pricing"]', type: 'pricing' },
    { selector: '[class*="form"]', type: 'form' },
    { selector: '[class*="modal"]', type: 'modal' },
  ];

  componentPatterns.forEach(({ selector, type }) => {
    const count = $(selector).length;
    if (count > 0) {
      analysis.components.push({ type, count });
    }
  });

  return analysis;
}

async function findAllHtmlFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findAllHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function generateTemplateReport(analyses) {
  const report = {
    totalPages: analyses.length,
    webflowClassUsage: {},
    commonCustomClasses: {},
    templatePatterns: {},
    collectionTypes: [],
    componentUsage: {},
    sectionPatterns: [],
  };

  // Aggregate Webflow class usage
  analyses.forEach(a => {
    Object.entries(a.webflowClasses).forEach(([type, classes]) => {
      if (!report.webflowClassUsage[type]) report.webflowClassUsage[type] = new Set();
      classes.forEach(c => report.webflowClassUsage[type].add(c));
    });
  });

  // Convert sets to arrays
  Object.keys(report.webflowClassUsage).forEach(k => {
    report.webflowClassUsage[k] = Array.from(report.webflowClassUsage[k]);
  });

  // Find common custom classes (used in >10% of pages)
  const classCount = {};
  analyses.forEach(a => {
    a.customClasses.forEach(c => {
      classCount[c] = (classCount[c] || 0) + 1;
    });
  });

  const threshold = analyses.length * 0.1;
  report.commonCustomClasses = Object.entries(classCount)
    .filter(([_, count]) => count > threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .reduce((acc, [cls, count]) => {
      acc[cls] = { count, percentage: ((count / analyses.length) * 100).toFixed(1) + '%' };
      return acc;
    }, {});

  // Aggregate component usage
  analyses.forEach(a => {
    a.components.forEach(({ type, count }) => {
      if (!report.componentUsage[type]) report.componentUsage[type] = { totalInstances: 0, pagesUsed: 0 };
      report.componentUsage[type].totalInstances += count;
      report.componentUsage[type].pagesUsed++;
    });
  });

  // Identify template patterns by grouping similar structures
  const structureGroups = {};
  analyses.forEach(a => {
    const key = JSON.stringify(a.structure);
    if (!structureGroups[key]) structureGroups[key] = { structure: a.structure, pages: [] };
    structureGroups[key].pages.push(a.file);
  });

  report.templatePatterns = Object.values(structureGroups)
    .sort((a, b) => b.pages.length - a.pages.length)
    .map(g => ({
      structure: g.structure,
      pageCount: g.pages.length,
      samplePages: g.pages.slice(0, 5),
    }));

  return report;
}

async function main() {
  console.log('Webflow Template Analyzer\n');
  console.log('='.repeat(50));

  const pagesDir = path.join(BACKUP_DIR, 'pages');

  let files;
  try {
    files = await findAllHtmlFiles(pagesDir);
  } catch (e) {
    console.log('No pages found yet. Run crawler.js first.');
    process.exit(0);
  }

  if (files.length === 0) {
    console.log('No HTML files found. Waiting for crawler to complete.');
    process.exit(0);
  }

  console.log(`Analyzing ${files.length} HTML files...\n`);

  const analyses = [];
  for (const file of files) {
    try {
      const analysis = await analyzeHtmlFile(file);
      analyses.push(analysis);
    } catch (e) {
      console.error(`Error analyzing ${file}: ${e.message}`);
    }
  }

  // Generate aggregated report
  const report = await generateTemplateReport(analyses);

  // Save detailed analysis
  await fs.writeFile(
    path.join(BACKUP_DIR, 'templates', 'detailed-analysis.json'),
    JSON.stringify(analyses, null, 2)
  );

  // Save summary report
  await fs.writeFile(
    path.join(BACKUP_DIR, 'templates', 'template-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Print summary
  console.log('='.repeat(50));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(50));
  console.log(`\nPages analyzed: ${report.totalPages}`);

  console.log('\nWebflow Class Types Found:');
  Object.entries(report.webflowClassUsage).forEach(([type, classes]) => {
    console.log(`  ${type}: ${classes.length} unique classes`);
  });

  console.log('\nTemplate Structure Patterns:');
  report.templatePatterns.slice(0, 5).forEach((p, i) => {
    console.log(`  Pattern ${i + 1}: ${p.pageCount} pages`);
    console.log(`    Structure: header=${p.structure.hasHeader}, nav=${p.structure.hasNav}, main=${p.structure.hasMain}, footer=${p.structure.hasFooter}`);
  });

  console.log('\nComponent Usage:');
  Object.entries(report.componentUsage)
    .sort((a, b) => b[1].totalInstances - a[1].totalInstances)
    .forEach(([type, data]) => {
      console.log(`  ${type}: ${data.totalInstances} instances across ${data.pagesUsed} pages`);
    });

  console.log('\nTop Custom Classes (site-specific styling):');
  Object.entries(report.commonCustomClasses).slice(0, 10).forEach(([cls, data]) => {
    console.log(`  .${cls}: used on ${data.percentage} of pages`);
  });

  console.log(`\nReports saved to ${path.join(BACKUP_DIR, 'templates')}/`);
}

main().catch(console.error);
