// actors/governance/check-compliance.mjs
import fs from 'fs';
import path from 'path';
import { newGatewayAndContract } from '../../gateway.js';



const [,, productId, ...rest] = process.argv;
if (!productId) {
  console.error('usage: node actors/governance/check-compliance.mjs <PRODUCT_ID>');
  process.exit(1);
}

const DEBUG = rest.includes('--debug');

const dec = new TextDecoder();

function decodeBytesToText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;

  // Buffer o Uint8Array dalla Fabric Gateway
  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    const txt = dec.decode(data);

    // Caso speciale: "123,34,105,..." (CSV di byte decimale)
    if (/^\s*\d{1,3}(?:\s*,\s*\d{1,3})+\s*$/.test(txt)) {
      const nums = txt.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
      const u8 = Uint8Array.from(nums);
      return dec.decode(u8);
    }
    return txt;
  }

  // Fallback
  try { return String(data); } catch { return ''; }
}

export function parseFabricJSON(data) {
  const txt = decodeBytesToText(data);
  try { return JSON.parse(txt); }
  catch { return { raw: txt }; }
}

export function printResponse(data) {
  const obj = parseFabricJSON(data);
  console.log(JSON.stringify(obj, null, 2));
}


// Ordine degli stage e mapping -> directory off-chain
const STAGES = [
  'RawSupplied',
  'GlassManufactured',
  'Assembling',
  'Construction',
  'Demolition',
  'Recycling',
  'Landfill',
];

const OFFCHAIN_DIRS = {
  RawSupplied:           'raw-materials',
  GlassManufactured:     'flat-glass',
  Assembling:            'windows-facade',
  Construction:          'construction',
  Demolition:            'demolition',
  Recycling:             'recycling',
  Landfill:              'land-filling',
};

// standard da tracciare (puoi aggiungere voci qui)
const STANDARDS = ['CE', 'REACH', 'RoHS'];

const OFFCHAIN_BASE = path.resolve(process.cwd(), '../off-chain-dpp/storage');

function listFilesSafe(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
}

function pickLatestJsonForProduct(dir, productId) {
  const entries = listFilesSafe(dir)
    .filter(d => d.isFile() && d.name.startsWith(productId) && d.name.endsWith('.json'))
    .map(d => {
      const full = path.join(dir, d.name);
      let mtime = 0;
      try { mtime = fs.statSync(full).mtimeMs; } catch {}
      return { full, mtime };
    })
    .sort((a, b) => a.mtime - b.mtime);
  return entries.length ? entries[entries.length - 1].full : null;
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function stageIndex(stage) {
  const i = STAGES.indexOf(stage);
  return i < 0 ? -1 : i;
}

const { gateway, client, contract } = await newGatewayAndContract('DppCore');
try {
  // 1) leggi lo stage corrente dalla chain
  const statusBytes = await contract.evaluateTransaction('GetProductStatus', productId);

  if (DEBUG) {
    console.error('[debug] GetProductStatus raw response:');
    printResponse(statusBytes);
  }

  const status = parseFabricJSON(statusBytes);
  const curr = status.currentStage || 'UNKNOWN';

  if (!STAGES.includes(curr)) {
    console.log(JSON.stringify({
      error: 'current stage is UNKNOWN (no off-chain traversal possible)',
      productId, currentStage: curr
    }, null, 2));
    process.exit(0);
  }

  // 2) per ogni stage fino a quello corrente, prova a leggere il file off-chain
  const upto = stageIndex(curr);
  const timeline = [];
  const merged = {}; // compliance cumulata (ultimo valore vince)

  for (let i = 0; i <= upto; i++) {
    const stg = STAGES[i];
    const dir = path.join(OFFCHAIN_BASE, OFFCHAIN_DIRS[stg]);
    const file = pickLatestJsonForProduct(dir, productId);
    if (!file) {
      timeline.push({ stage: stg, file: null, compliance: null });
      continue;
    }
    const js = readJsonSafe(file);
    const comp = js && js.compliance && typeof js.compliance === 'object' ? js.compliance : null;

    if (comp) {
      // merge "last write wins"
      for (const key of Object.keys(comp)) merged[key] = comp[key];
      timeline.push({ stage: stg, file, compliance: comp });
    } else {
      timeline.push({ stage: stg, file, compliance: null });
    }
  }

  // 3) sintetizza l’esito per ciascuna norma
  const result = {};
  for (const std of STANDARDS) {
    if (!(std in merged)) result[std] = 'unknown';
    else result[std] = merged[std] ? 'pass' : 'fail';
  }

  console.log(JSON.stringify({
    ok: true,
    productId,
    currentStage: curr,
    compliance: result,
    details: timeline
  }, null, 2));
} finally {
  gateway.close();
  client.close();
}

