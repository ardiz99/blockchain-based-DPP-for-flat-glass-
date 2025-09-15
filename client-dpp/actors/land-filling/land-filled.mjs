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
  console.error('Usage: node actors/land-filling/land-filled.mjs -- <productId> <offchain-json-path> [<demolition-json>]');
  process.exit(1);
}

// 1) leggo JSON off-chain (parametri “ricchi” qui)
const dataTxt = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(dataTxt);

// campi suggeriti (puoi ampliarli liberamente senza toccare on-chain)
const required = ['reasonForDisposal','nonReusability','hazardousMaterials','environmentalImpact'];
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
            console.warn(`[landfill] WARNING: nel demolition file manca recoveryPotential.recommendedPath (${demolitionPath}). Procedo comunque.`);
        }
        else if (String(rec).toLowerCase() !== 'landfill') {
            console.error(`[landfill] BLOCCATO: per ${productId} il recommendedPath è '${rec}'. Usa il flusso GlassRecycler invece del riciclo.`);
            process.exit(2)
        }
        else {
            console.log(`[landfill] OK: demolition consiglia '${rec}'. Procedo col landfill`);
        }
    }
    catch (e) {
        console.warn(`[landfill] WARNING: demolition file non leggibile (${demolitionPath}): ${e.message}. Procedo comunque.`);
    }
}
else {
    console.warn(`[landfill] WARNING: demolition file non trovato (${demolitionPath}). Procedo comunque.`);
}

// 2) hash + uri del file off-chain
const buf = Buffer.from(dataTxt, 'utf8');
const processHash = crypto.createHash('sha256').update(buf).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) submit on-chain
const { gateway, client, contract } = await newGatewayAndContract('LandFill');
try {
  const res = await contract.submitTransaction(
    'LandFill:landFill',
    productId, processHash, processUri
  );
  printResponse(res);

  // 4) log off-chain “normalizzato”
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'landfill');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'LandFill',
    processUri, processHash,
    reasonForDisposal: data.reasonForDisposal,
    nonReusability: data.nonReusability,
    hazardousMaterials: data.hazardousMaterials,
    environmentalImpact: data.environmentalImpact,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}
