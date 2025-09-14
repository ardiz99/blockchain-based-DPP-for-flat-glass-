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
  console.error('Usage: node actors/demolition/demolish.mjs -- <productId> <offchain-json-path>');
  process.exit(1);
}

// 1) leggo lo JSON off-chain (qui ci metti i campi richiesti)
const dataTxt = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(dataTxt);

// opzionale ma utile: verifica dei campi attesi
const required = [
  'disassemblyInstructions',
  'endOfLifeCondition',
  'recoveryPotential',
  'wasteSegregation'
];
for (const k of required) {
  if (!(k in data)) {
    console.error(`Missing '${k}' in ${filePath}`);
    process.exit(1);
  }
}

// 2) calcolo hash + uri del file off-chain
const buf = Buffer.from(dataTxt, 'utf8');
const processHash = crypto.createHash('sha256').update(buf).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) submit on-chain
const { gateway, client, contract } = await newGatewayAndContract('Demolition');
try {
  const res = await contract.submitTransaction(
    'DemolitionTeam:demolitionProduct',
    productId, processHash, processUri
  );
  printResponse(res);

  // 4) log off-chain
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'demolition');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'Demolition',
    processUri, processHash,
    disassemblyInstructions: data.disassemblyInstructions,
    endOfLifeCondition: data.endOfLifeCondition,
    recoveryPotential: data.recoveryPotential,
    wasteSegregation: data.wasteSegregation,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}
