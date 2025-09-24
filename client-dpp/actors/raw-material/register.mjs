// actors/raw-material/register.mjs
import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath, overrideBatch] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node actors/raw-material/register.mjs -- <productId> <offchain-json-path> [supplierBatch]');
  process.exit(1);
}

// 1) leggi JSON off-chain
let dataTxt;
try {
  dataTxt = fs.readFileSync(filePath, 'utf8');
} catch (e) {
  console.error(`Cannot read file: ${filePath}\n${e.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(dataTxt);
} catch (e) {
  console.error(`Not a valid JSON: ${filePath}\n${e.message}`);
  process.exit(1);
}

// 2) validazione minima per evitare file di altri attori
const required = ['supplierId', 'batchNo', 'composition'];
const errors = [];
for (const k of required) {
  if (!(k in data)) errors.push(`Missing '${k}' in ${filePath}`);
}
if (data.composition && typeof data.composition !== 'object') {
  errors.push(`'composition' must be an object`);
}

if (errors.length) {
  console.error(`Off-chain JSON does not look like a raw-material file:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

// 3) calcolo hash + uri del file off-chain
const buf = Buffer.from(dataTxt, 'utf8');
const processHash = crypto.createHash('sha256').update(buf).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 4) submit on-chain
const { gateway, client, contract } = await newGatewayAndContract('RawMaterialSupplier');
try {
  // NB: lascia la function che hai nel chaincode. Se si chiama diversamente, cambia SOLO questa stringa.
  const supplierBatch = overrideBatch || data.batchNo;
  const res = await contract.submitTransaction(
    'RawMaterial:RegisterRawMaterial',
    productId, processHash, processUri, supplierBatch
  );
  printResponse(res);

  // 5) log off-chain (stile demolish)
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'raw-materials');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'RawMaterialRegistered',
    processUri, processHash,
    supplierBatch,
    supplierId: data.supplierId,
    origin: data.origin ?? null,
    composition: data.composition,
    weightKg: data.weightKg ?? null,
    // compliance nel file può restare, ma NON serve ai check qui
    payload: data,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close();
  client.close();
}
