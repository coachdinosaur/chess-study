/**
 * CD Digital Chess — Top Players Data Fetcher
 * Fetches official FIDE ratings for 6 categories (Top 20 players each):
 *  1. Top 20 Standard (World Open)
 *  2. Top 20 World Women
 *  3. Top 20 World Blitz
 *  4. Top 20 Philippines (Standard Open)
 *  5. Top 20 PH Women
 *  6. Top 20 Singapore (Standard Open)
 *
 * Generates: assets/top-players.json
 *
 * Usage: node tools/fetch_top_players.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.join(__dirname, '..', 'assets', 'top-players.json');

const CATEGORIES = [
  {
    id: 'world_standard',
    title: 'Top 20 Standard (World)',
    shortTitle: 'World Standard',
    category: 'Standard',
    flag: '🌐',
    url: 'https://ratings.fide.com/a_top.php?list=open'
  },
  {
    id: 'world_women',
    title: 'Top 20 World Women',
    shortTitle: 'World Women',
    category: 'Women',
    flag: '👑',
    url: 'https://ratings.fide.com/a_top.php?list=women'
  },
  {
    id: 'world_blitz',
    title: 'Top 20 World Blitz',
    shortTitle: 'World Blitz',
    category: 'Blitz',
    flag: '⚡',
    url: 'https://ratings.fide.com/a_top.php?list=men_blitz'
  },
  {
    id: 'philippines',
    title: 'Top 20 Philippines',
    shortTitle: 'Philippines',
    category: 'Country',
    flag: '🇵🇭',
    url: 'https://ratings.fide.com/a_top_var.php?country=PHI&rating=standard'
  },
  {
    id: 'philippines_women',
    title: 'Top 20 PH Women',
    shortTitle: 'PH Women',
    category: 'Country Women',
    flag: '🇵🇭',
    url: 'https://ratings.fide.com/a_top_var.php?country=PHI&rating=standard&gender=F'
  },
  {
    id: 'singapore',
    title: 'Top 20 Singapore',
    shortTitle: 'Singapore',
    category: 'Country',
    flag: '🇸🇬',
    url: 'https://ratings.fide.com/a_top_var.php?country=SGP&rating=standard'
  }
];

// ISO / Olympic country code to Flag Emoji mapping
const FED_FLAGS = {
  NOR: '🇳🇴',
  USA: '🇺🇸',
  UZB: 'UZ',
  GER: '🇩🇪',
  IND: '🇮🇳',
  CHN: '🇨🇳',
  KAZ: '🇰🇿',
  FRA: '🇫🇷',
  RUS: '🇷🇺',
  FID: '🏳️',
  PHI: '🇵🇭',
  SGP: '🇸🇬',
  POL: '🇵🇱',
  NED: '🇳🇱',
  GEO: '🇬🇪',
  UKR: '🇺🇦',
  AZE: '🇦🇿',
  ESP: '🇪🇸',
  HUN: '🇭🇺',
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  VIE: '🇻🇳',
  INA: '🇮🇩',
  MAS: '🇲🇾',
  THA: '🇹🇭',
  SUI: '🇨🇭',
  SLO: '🇸🇮',
  IRI: '🇮🇷'
};

// Known official FIDE titles for curated top players
const KNOWN_TITLES = {
  // World Standard & Blitz Open
  '1503014': 'GM',  // Carlsen, Magnus
  '2020009': 'GM',  // Caruana, Fabiano
  '2016192': 'GM',  // Nakamura, Hikaru
  '14205483': 'GM', // Sindarov, Javokhir
  '12940690': 'GM', // Keymer, Vincent
  '5202213': 'GM',  // So, Wesley
  '24116068': 'GM', // Giri, Anish
  '14204118': 'GM', // Abdusattorov, Nodirbek
  '35009192': 'GM', // Erigaisi Arjun
  '12573981': 'GM', // Firouzja, Alireza
  '8603405': 'GM',  // Wei, Yi
  '25059530': 'GM', // Praggnanandhaa R
  '1170546': 'GM',  // Duda, Jan-Krzysztof
  '5000017': 'GM',  // Anand, Viswanathan
  '8603677': 'GM',  // Ding, Liren
  '12401137': 'GM', // Le, Quang Liem
  '3503240': 'GM',  // Dominguez Perez, Leinier
  '738590': 'GM',   // Rapport, Richard
  '1039784': 'GM',  // Van Foreest, Jorden
  '12521213': 'GM', // Tabatabaei, M. Amin
  '24126055': 'GM', // Dubov, Daniil
  '4168119': 'GM',  // Nepomniachtchi, Ian
  '623539': 'GM',   // Vachier-Lagrave, Maxime
  '24130737': 'GM', // Fedoseev, Vladimir
  '8603820': 'GM',  // Yu, Yangyi
  '25092340': 'GM', // Nihal Sarin
  '8601445': 'GM',  // Bu, Xiangzhi
  '13300474': 'GM', // Aronian, Levon
  '24101605': 'GM', // Artemiev, Vladislav
  '2093596': 'GM',  // Niemann, Hans Moke
  '8603332': 'GM',  // Lu, Shanglei

  // World Women
  '8602980': 'GM',  // Hou, Yifan
  '8605114': 'GM',  // Lei, Tingjie
  '8603006': 'GM',  // Ju, Wenjun
  '8608059': 'GM',  // Zhu, Jiner
  '13708694': 'IM', // Assaubayeva, Bibisara
  '4147103': 'GM',  // Goryachkina, Aleksandra
  '14111330': 'GM', // Muzychuk, Anna
  '5008123': 'GM',  // Koneru, Humpy
  '8603642': 'GM',  // Tan, Zhongyi
  '24171760': 'IM', // Shuvalova, Polina
  '14109336': 'GM', // Lagno, Kateryna
  '4128125': 'GM',  // Kosteniuk, Alexandra
  '35006916': 'IM', // Divya Deshmukh
  '5091756': 'GM',  // Vaishali, Rameshbabu
  '13601903': 'GM', // Dzagnidze, Nana
  '4198026': 'GM',  // Kashlinskaya, Alina
  '14198339': 'WFM',// Hnatyshyn, Anastasiia
  '14114550': 'GM', // Muzychuk, Mariya
  '13602993': 'GM', // Batsiashvili, Nino
  '2090732': 'IM',  // Yip, Carissa

  // Philippines Open
  '5201268': 'GM',  // Sadorra, Julio Catalino
  '5200750': 'GM',  // Garcia, Jan Emmanuel
  '5217911': 'GM',  // Quizon, Daniel
  '5200016': 'GM',  // Torre, Eugenio
  '5206995': 'IM',  // Bersamina, Paulo
  '5202248': 'IM',  // Dimakiling, Oliver
  '5220394': 'IM',  // Bacojo, Mark Jay
  '5202809': 'IM',  // Yap, Kim Steven
  '5201241': 'GM',  // Paragua, Mark
  '5201640': 'GM',  // Barbosa, Oliver
  '5217873': 'IM',  // Concio, Michael Jr.
  '5201330': 'GM',  // Laylo, Darwin
  '5201047': 'IM',  // Salvador, Roland
  '5203597': 'FM',  // Ballecer, Dino
  '5258138': 'FM',  // Arca, Christian Gian Karlo
  '5201381': 'GM',  // Gomez, John Paul
  '5204100': 'FM',  // Severino, Sander
  '5200032': 'GM',  // Antonio, Rogelio Jr
  '5245010': 'FM',  // Cu, Ivan Travis
  '5204860': 'IM',  // Pimentel, Joel

  // Philippines Women
  '5212499': 'WGM', // Frayna, Janelle Mae
  '5220416': 'WIM', // Canino, Ruelle
  '5204585': 'WIM', // Fronda, Jan Jodilyn
  '5262062': 'WFM', // Mendoza, Jemaicah Yap
  '5211158': 'WIM', // Mendoza, Shania Mae
  '5208912': 'WIM', // Galas, Bernadette
  '5205204': 'WIM', // San Diego, Marie Antoinette
  '5236215': 'WFM', // Marticio, Jersey
  '5217962': 'WFM', // Sebastian, Mhage Gerriahlou
  '5216729': 'WIM', // Doroy, Allanney Jia
  '5201071': 'WIM', // Isurina Mariano, Cristine Rose
  '5238480': 'WFM', // Hernandez, Lexie Grace
  '5216257': 'WFM', // Magpily, Francois Marie
  '5206880': 'WFM', // Mejia, Cherry Ann
  '5219086': 'WIM', // Mordido, Kylen Joy
  '5220424': 'WFM', // Dela Cruz, Daren
  '5205085': 'WFM', // Revita, Samantha Glo
  '5264022': 'WCM', // Ordizo, Kate Nicole
  '5238447': 'WFM', // Claros, April Joy
  '5229820': 'WCM', // Regidor, Kaye Lalaine

  // Singapore Open
  '5804418': 'GM',  // Tin, Jingyao
  '5818320': 'GM',  // Siddharth, Jagadeesh
  '8605718': 'IM',  // Liu, Xiangyi
  '5800323': 'IM',  // Toh, Terry
  '5819156': 'IM',  // Goh, Zi Han
  '5821975': 'FM',  // Wong, Zhenyong Jayden
  '33387230': 'CM', // Ashwath Kaushik
  '5200393': 'GM',  // Villamayor, Buenaventura
  '5201322': 'IM',  // Paciencia, Enrique
  '5801664': 'FM',  // Foo, Zhi Rong Benjamin
  '8602425': 'WGM', // Gong, Qianyun (IM)
  '5800196': 'IM',  // Pang, Kwok Leong
  '25996045': 'WCM',// Sreekarthika Velmurugan
  '5800358': 'FM',  // Lee, Wang Sheng
  '5804566': 'WFM', // Hng, Mei-En Emmanuelle
  '5804540': 'FM',  // Goh, Jinghan Cameron
  '5827701': 'CM',  // Wong, Yen-Hsiu Elliot
  '5826985': 'CM',  // Tan, Yi Rui Ray
  '5833884': 'CM',  // Gnanasekar, Jai Adithya
  '5828678': 'CM'   // Sanjay, Vasu
};

/**
 * Clean and format player name from "Last, First" to "First Last"
 */
function formatDisplayName(fideName) {
  if (!fideName) return '';
  const parts = fideName.split(',').map((p) => p.trim());
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return fideName.trim();
}

/**
 * Fetch HTML via HTTP/1.1 to avoid HTTP/2 issues with FIDE's server
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html, */*'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }
    ).on('error', reject);
  });
}

/**
 * Parse FIDE table rows for Top 20
 */
function parseTableRows(html, isWomenCategory = false) {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const players = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    if (tds.length < 5) continue;

    // FIDE ID & profile URL
    const idMatch = row.match(/href=["']?(?:\/profile\/|.*profile\.phtml\?event=)(\d+)["']?/i);
    const fideId = idMatch ? idMatch[1] : '';

    // Clean cell text
    const cleanCells = tds.map((td) => {
      return td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    });

    const rank = parseInt(cleanCells[0], 10) || players.length + 1;
    const fideName = cleanCells[1] || '';
    const fed = cleanCells[2] || '';
    const rating = parseInt(cleanCells[3], 10) || 0;
    const birthYear = parseInt(cleanCells[4], 10) || null;

    if (!fideName || !rating) continue;

    let title = KNOWN_TITLES[fideId] || '';
    if (!title) {
      if (rating >= 2500) title = 'GM';
      else if (rating >= 2400) title = isWomenCategory ? 'WGM' : 'IM';
      else if (rating >= 2300) title = isWomenCategory ? 'WIM' : 'FM';
      else if (rating >= 2200) title = isWomenCategory ? 'WFM' : 'CM';
      else if (rating >= 2000) title = isWomenCategory ? 'WCM' : 'CM';
    }

    players.push({
      rank,
      name: formatDisplayName(fideName),
      fideName,
      title,
      fed,
      flagEmoji: FED_FLAGS[fed] || '🏳️',
      rating,
      birthYear,
      fideId,
      profileUrl: fideId ? `https://ratings.fide.com/profile/${fideId}` : ''
    });

    if (players.length >= 20) break;
  }

  return players;
}

async function main() {
  console.log('Fetching FIDE Top 20 Chess Players Data...');
  const outputData = {
    updatedAt: new Date().toISOString().split('T')[0],
    source: 'FIDE (International Chess Federation)',
    sourceUrl: 'https://ratings.fide.com',
    categories: {}
  };

  for (const cat of CATEGORIES) {
    console.log(`Fetching ${cat.title}...`);
    try {
      const html = await fetchHtml(cat.url);
      const isWomen = cat.category.includes('Women');
      const players = parseTableRows(html, isWomen);
      console.log(`  -> Parsed ${players.length} players for ${cat.shortTitle}`);

      outputData.categories[cat.id] = {
        id: cat.id,
        title: cat.title,
        shortTitle: cat.shortTitle,
        category: cat.category,
        flag: cat.flag,
        url: cat.url,
        players
      };
    } catch (err) {
      console.error(`Failed fetching ${cat.title}: ${err.message}`);
    }
  }

  // Ensure assets directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`\nSuccessfully saved top 20 players data to: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error in fetch_top_players:', err);
  process.exit(1);
});
