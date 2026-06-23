const fs = require('fs');
const path = require('path');
const https = require('https');

const urls = [
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv'
];

const outputPath = path.join(__dirname, '..', 'assets', 'openings.tsv');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: Status Code ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Fetching opening TSV files...');
    const contents = [];
    for (const url of urls) {
      console.log(`Fetching ${url}...`);
      const text = await fetchUrl(url);
      contents.push(text);
    }

    console.log('Merging files...');
    let merged = '';
    let isFirst = true;

    for (const text of contents) {
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) continue;

      const header = lines[0];
      const dataLines = lines.slice(1);

      if (isFirst) {
        merged += header + '\n';
        isFirst = false;
      }

      for (const line of dataLines) {
        if (line.trim()) {
          merged += line + '\n';
        }
      }
    }

    // Ensure assets directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, merged.trim() + '\n', 'utf8');
    console.log(`Successfully merged openings into ${outputPath}`);
  } catch (error) {
    console.error('Error fetching/merging openings:', error);
    process.exit(1);
  }
}

main();
