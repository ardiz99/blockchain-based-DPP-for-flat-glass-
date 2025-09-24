// actors/flat-glass/manufacture.mjs
import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, productId, filePath, batchNo='', furnaceId='', culletRatio=''] = process.argv;

const dec = new TextDecoder();
function printResponse(bytes) {
  const txt = Buffer.isBuffer(bytes) || bytes instanceof Uint8Array ? dec.decode(bytes) : String(bytes ?? '');
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
}

if (!productId || !filePath) {
  console.error('Usage: node actors/flat-glass/manufacture.mjs <PRODUCT_ID> <offchain-json-path> [batchNo] [furnaceId] [culletRatio]');
  process.exit(1);
}

// 1) leggi e valida il JSON off-chain
const raw = fs.readFileSync(filePath, 'utf8');
let data;
try { data = JSON.parse(raw); }
catch {
  console.error(`Invalid JSON: ${filePath}`);
  process.exit(1);
}

const requiredTop = ['glassType', 'line', 'furnace', 'energyKWh', 'composition', 'dimensions'];
for (const k of requiredTop) {
  if (!(k in data)) {
    console.error(`Missing '${k}' in ${filePath}`);
    process.exit(1);
  }
}

if (typeof data.energyKWh !== 'number' || !Number.isFinite(data.energyKWh) || data.energyKWh < 0) {
  console.error(`'energyKWh' must be a non-negative number`);
  process.exit(1);
}

if (typeof data.composition !== 'object' || data.composition === null) {
  console.error(`'composition' must be an object (e.g., {SiO2:72, Na2O:14, ...})`);
  process.exit(1);
}

if (typeof data.dimensions !== 'object' || data.dimensions === null) {
  console.error(`'dimensions' must be an object (e.g., {thicknessMm:6, widthMm:1200, heightMm:600})`);
  process.exit(1);
}

const dims = data.dimensions;
for (const key of ['thicknessMm','widthMm','heightMm']) {
  if (!(key in dims) || typeof dims[key] !== 'number' || dims[key] <= 0) {
    console.error(`'dimensions.${key}' must be a positive number`);
    process.exit(1);
  }
}

// 2) calcola hash + URI del file processo
const processHash = crypto.createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) invia on-chain (3 parametri uniformi)
const { gateway, client, contract } = await newGatewayAndContract('GlassManufacturer');
try {
  const res = await contract.submitTransaction('GlassManufacturer:ManufactureGlass', productId, processHash, processUri, batchNo, furnaceId, culletRatio);
  printResponse(res);

  // 4) salva log off-chain normalizzato
  const outDir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'flat-glass');
  fs.mkdirSync(outDir, { recursive: true });

  const out = {
    productId,
    stage: 'GlassManufactured',
    txAt: new Date().toISOString(),
    processUri,
    processHash,
    meta: { batchNo, furnaceId, culletRatio },
    // snapshot dei dati principali
    glassType: data.glassType,
    line: data.line,
    furnace: data.furnace,
    energyKWh: data.energyKWh,
    composition: data.composition,   // es: { SiO2:72, Na2O:14, CaO:8, MgO:4, Al2O3:2 }
    dimensions: data.dimensions,     // es: { thicknessMm:6, widthMm:1200, heightMm:600 }
    // eventuali campi extra: compliance, defects, coatings, ecc. pass-through
    ...(data.compliance ? { compliance: data.compliance } : {}),
    ...(data.defects ? { defects: data.defects } : {}),
    ...(data.coatings ? { coatings: data.coatings } : {})
  };

  const outFile = path.join(outDir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', outFile);
} finally {
  gateway.close();
  client.close();
}
