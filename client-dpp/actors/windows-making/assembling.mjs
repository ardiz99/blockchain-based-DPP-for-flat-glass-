import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, productId, filePath, sku='', specPath=''] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node actors/windows-making/assembling.mjs <productId> <filePath> [sku] [specJsonFile]');
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const assemblyHash = crypto.createHash('sha256').update(buf).digest('hex');
const assemblyUri  = 'file://' + path.resolve(filePath);

let specJson = '{}';
if (specPath) {
  specJson = fs.readFileSync(specPath, 'utf8');
}

const { gateway, client, contract } = await newGatewayAndContract('Assembler');
try {
  const res = await contract.submitTransaction(
    'Assembler:AssembleProduct',
    productId, assemblyHash, assemblyUri, sku, specJson
  );
  printResponse(res);

  // off-chain log
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'assembling');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'Assembling',
    assemblyUri, assemblyHash, sku,
    spec: specPath ? JSON.parse(specJson) : undefined,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}
