// client-dpp/flat-glass/manufacture.mjs
import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath, batchNo='', furnaceId='', culletRatio=''] = process.argv;

const dec = new TextDecoder();

function printResponse(bytes) {
  const txt = dec.decode(bytes);
  try {
    const obj = JSON.parse(txt);
    console.log(JSON.stringify(obj, null, 2));
  } catch {
    console.log(txt);
  }
}

if (!productId || !filePath) {
  console.error('Usage: node client-dpp/flat-glass/manufacture.mjs <productId> <filePath> [batchNo] [furnaceId] [culletRatio]');
  process.exit(1);
}

// calcola hash e uri del file di processo
const buf  = fs.readFileSync(filePath);
const processHash = crypto.createHash('sha256').update(buf).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// apre connessione (Org3)
const { gateway, client, contract } = await newGatewayAndContract('GlassManufacturer');
try {
  const res = await contract.submitTransaction(
    'GlassManufacturer:ManufactureGlass',
    productId, processHash, processUri, batchNo, furnaceId, culletRatio
  );

  // stampa come nel raw material
  printResponse(res);

  // ricava lo stage dalla risposta SENZA usare 'out'
  let stage = 'GlassManufactured';
  try {
    const txt = dec.decode(res);
    const obj = JSON.parse(txt);
    stage = obj.currentStage || obj.stage || stage;
  } catch { /* keep default */ }

  // salvataggio off-chain
  const offchainDir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'flat-glass');
  fs.mkdirSync(offchainDir, { recursive: true });
  const payload = {
    productId,
    stage,
    processUri,
    processHash,
    meta: { batchNo, furnaceId, culletRatio },
    txAt: new Date().toISOString()
  };
  const file = path.join(offchainDir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Saved off-chain ->', file);

} finally {
  gateway.close();
  client.close();
}