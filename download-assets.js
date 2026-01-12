const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ASSETS_DIR = './backup/assets/files';
const CONCURRENCY = 5;

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', async () => {
        await fs.writeFile(destPath, Buffer.concat(chunks));
        resolve(true);
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function getLocalPath(url) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname) || '.bin';
    const name = parsed.pathname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    return path.join(ASSETS_DIR, name.slice(-100) + (ext.length > 5 ? '.bin' : ext));
  } catch {
    return null;
  }
}

async function main() {
  console.log('Asset Downloader for La Biblia Explicada\n');

  // Load asset URLs
  const assetUrlsPath = './backup/assets/asset-urls.json';
  let assets;
  try {
    const content = await fs.readFile(assetUrlsPath, 'utf8');
    assets = JSON.parse(content);
  } catch (e) {
    console.error('No asset URLs found. Run crawler.js first.');
    process.exit(1);
  }

  console.log(`Found ${assets.length} assets to download\n`);

  await fs.mkdir(ASSETS_DIR, { recursive: true });

  const stats = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Process in batches
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (url) => {
      const localPath = getLocalPath(url);
      if (!localPath) {
        stats.skipped++;
        return;
      }

      try {
        // Check if already downloaded
        await fs.access(localPath);
        stats.skipped++;
        console.log(`[SKIP] ${path.basename(localPath)}`);
      } catch {
        try {
          await downloadFile(url, localPath);
          stats.success++;
          console.log(`[OK] ${path.basename(localPath)}`);
        } catch (e) {
          stats.failed++;
          stats.errors.push({ url, error: e.message });
          console.error(`[FAIL] ${url}: ${e.message}`);
        }
      }
    }));
  }

  console.log('\n' + '='.repeat(50));
  console.log('DOWNLOAD COMPLETE');
  console.log('='.repeat(50));
  console.log(`Success: ${stats.success}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);

  // Save download stats
  await fs.writeFile(
    './backup/assets/download-stats.json',
    JSON.stringify(stats, null, 2)
  );
}

main().catch(console.error);
