// actors/windows-making/assembling.mjs
import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, productId, filePath, sku=''] = process.argv;

const dec = new TextDecoder();
function printResponse(bytes) {
  const txt = Buffer.isBuffer(bytes) || bytes instanceof Uint8Array ? dec.decode(bytes) : String(bytes ?? '');
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
}

if (!productId || !filePath) {
  console.error('Usage: node actors/windows-making/assembling.mjs <PRODUCT_ID> <offchain-json-path> [sku]');
  process.exit(1);
}

// 1) leggi + valida JSON off-chain
const raw = fs.readFileSync(filePath, 'utf8');
let data;
try { data = JSON.parse(raw); }
catch {
  console.error(`Invalid JSON: ${filePath}`);
  process.exit(1);
}

// campi richiesti minimi
const required = ['width','height','frame','glazing','uw','assemblerId'];
for (const k of required) {
  if (!(k in data)) {
    console.error(`Missing '${k}' in ${filePath}`);
    process.exit(1);
  }
}
const toNum = v => (typeof v === 'number' ? v : Number(v));
const width  = toNum(data.width);
const height = toNum(data.height);
const uw     = toNum(data.uw);

if (!Number.isFinite(width) || width <= 0)  { console.error(`'width' must be > 0`);  process.exit(1); }
if (!Number.isFinite(height) || height <= 0){ console.error(`'height' must be > 0`); process.exit(1); }
if (!Number.isFinite(uw) || uw <= 0)        { console.error(`'uw' must be > 0`);     process.exit(1); }
if (typeof data.frame !== 'string' || !data.frame.trim()) {
  console.error(`'frame' must be a non-empty string`); process.exit(1);
}
if (typeof data.glazing !== 'string' || !data.glazing.trim()) {
  console.error(`'glazing' must be a non-empty string`); process.exit(1);
}
if (typeof data.assemblerId !== 'string' || !data.assemblerId.trim()) {
  console.error(`'assemblerId' must be a non-empty string`); process.exit(1);
}

const unitType = (data.unitType && String(data.unitType).trim()) || 'Double Insulated Glass Unit';

// check veloce: se è “Double …” il glazing dovrebbe essere tipo 4/16/4 (due vetri)
if (/^double/i.test(unitType)) {
  const twoPane = /^\s*\d+\s*\/\s*\d+\s*\/\s*\d+\s*$/;
  if (!twoPane.test(data.glazing)) {
    console.error(`'glazing' should look like '4/16/4' for a Double IGU (got '${data.glazing}')`);
    process.exit(1);
  }
}

// 2) calcola hash + uri del file di input (tracciabilità)
const processHash = crypto.createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) submit on-chain (3 parametri)
const { gateway, client, contract } = await newGatewayAndContract('Assembler');
try {
  const res = await contract.submitTransaction('Assembler:AssembleProduct', productId, processHash, processUri);
  printResponse(res);

  // 4) salva log off-chain normalizzato
  const outDir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'windows-facade');
  fs.mkdirSync(outDir, { recursive: true });

  const out = {
    productId,
    stage: 'Assembled',
    txAt: new Date().toISOString(),
    processUri, processHash, sku,

    // snapshot degli input principali
    unitType,
    assemblerId: data.assemblerId,
    frame: data.frame,
    glazing: data.glazing,   // es: "4/16/4"
    uw,
    dimensions: { widthMm: width, heightMm: height },

    // campi opzionali utili in ottica DPP
    ...(data.facility ? { facility: data.facility } : {}),
    ...(data.location ? { location: data.location } : {}),               // es: "IT-MI" o GPS
    ...(data.assemblyDate ? { assemblyDate: data.assemblyDate } : {}),   // ISO date
    ...(data.gasFill ? { gasFill: data.gasFill } : {}),                   // "argon", "air"
    ...(data.spacerType ? { spacerType: data.spacerType } : {}),
    ...(data.sealant ? { sealant: data.sealant } : {}),
    ...(data.coating ? { coating: data.coating } : {}),
    ...(data.compliance ? { compliance: data.compliance } : {})
  };

  const outFile = path.join(outDir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', outFile);
} finally {
  gateway.close();
  client.close();
}
