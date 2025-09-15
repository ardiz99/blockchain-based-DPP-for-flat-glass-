import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath, demolitionPathArg] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node actors/recycling/recycled.mjs -- <productId> <offchain-json-path> [<demolition-json>]');
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

const defaultDemolitionPath = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'demolition', `${productId}.json`);
const demolitionPath = demolitionPathArg || defaultDemolitionPath;

if (fs.existsSync(demolitionPath)) {
    try {
        const demolition = JSON.parse(fs.readFileSync(demolitionPath, 'utf8'));
        const rec = demolition?.recoveryPotential?.recommendedPath;
        if (!rec) {
            console.warn(`[recycling] WARNING: nel demolition file manca recoveryPotential.recommendedPath (${demolitionPath}). Procedo comunque.`);
        }
        else if (String(rec).toLowerCase() !== 'recycling') {
            console.error(`[recycling] BLOCCATO: per ${productId} il recommendedPath è '${rec}'. Usa il flusso LandFiller invece del riciclo.`);
            process.exit(2)
        }
        else {
            console.log(`[recycling] OK: demolition consiglia '${rec}'. Procedo col riciclo.`);
        }
    }
    catch (e) {
        console.warn(`[recycling] WARNING: demolition file non leggibile (${demolitionPath}): ${e.message}. Procedo comunque.`);
    }
}
else {
    console.warn(`[recycling] WARNING: demolition file non trovato (${demolitionPath}). Procedo comunque.`);
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
