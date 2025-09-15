import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node actors/recycling/recycled.mjs -- <productId> <offchain-json-path>');
  process.exit(1);
}

// 1) leggo JSON off-chain (parametri “ricchi” qui)
const dataTxt = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(dataTxt);

// campi suggeriti (puoi ampliarli liberamente senza toccare on-chain)
const required = [
  'culletBatchId',            // lotto di rottame
  'recyclingMethod',          // es. crushing+washing
  'contaminationLevel',       // %
  'recycledMassRatio',        // %
  'culletQualityGrade',       // A/B/C...
  'outputs',                  // es. { culletKg: ..., finesKg: ... }
  'emissions',                // CO2e o note ambientali
];
for (const k of required) {
  if (!(k in data)) {
    console.error(`Missing '${k}' in ${filePath}`);
    process.exit(1);
  }
}

// 2) hash + uri del file off-chain
const buf = Buffer.from(dataTxt, 'utf8');
const processHash = crypto.createHash('sha256').update(buf).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) submit on-chain
const { gateway, client, contract } = await newGatewayAndContract('Recycling');
try {
  const res = await contract.submitTransaction(
    'GlassRecycler:recyclingGlass',
    productId, processHash, processUri
  );
  printResponse(res);

  // 4) log off-chain “normalizzato”
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'recycling');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'Recycling',
    processUri, processHash,
    culletBatchId: data.culletBatchId,
    recyclingMethod: data.recyclingMethod,
    contaminationLevel: data.contaminationLevel,
    recycledMassRatio: data.recycledMassRatio,
    culletQualityGrade: data.culletQualityGrade,
    outputs: data.outputs,
    emissions: data.emissions,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}
