import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from '../vendor/chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '../assets/openings.tsv');
const outputPath = path.join(__dirname, '../assets/openings_processed.tsv');

async function main() {
  try {
    console.log('Reading raw openings...');
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const header = lines[0]; // eco	name	pgn
    const dataLines = lines.slice(1);

    console.log(`Processing ${dataLines.length} lines...`);
    const outputLines = ['eco\tname\tpgn\tuci\tepd'];

    let count = 0;
    let errors = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line.trim()) continue;

      const cols = line.split('\t');
      if (cols.length < 3) continue;

      const [eco, name, pgn] = cols;

      // Extract moves by splitting on spaces and filtering out move numbers/dots
      const moveTokens = pgn.split(/\s+/).filter(t => t && !t.includes('.'));

      const chess = new Chess();
      const uciMoves = [];
      let success = true;

      for (const move of moveTokens) {
        try {
          const result = chess.move(move);
          const uci = result.from + result.to + (result.promotion || '');
          uciMoves.push(uci);
        } catch (e) {
          console.error(`Line ${i + 2}: Error playing move "${move}" in PGN "${pgn}":`, e.message);
          success = false;
          break;
        }
      }

      if (success) {
        const uciSequence = uciMoves.join(' ');
        const fen = chess.fen();
        const fenParts = fen.split(' ');
        const epd = fenParts.slice(0, 4).join(' ');
        outputLines.push(`${eco}\t${name}\t${pgn}\t${uciSequence}\t${epd}`);
        count++;
      } else {
        errors++;
      }
    }

    // Overwrite the original openings.tsv with the processed 5-column version
    fs.writeFileSync(inputPath, outputLines.join('\n') + '\n', 'utf8');
    console.log(`Successfully processed ${count} openings. Errors: ${errors}. Saved to ${inputPath}`);
    
    // Clean up temporary files if any
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  } catch (error) {
    console.error('Error processing openings:', error);
    process.exit(1);
  }
}

main();
