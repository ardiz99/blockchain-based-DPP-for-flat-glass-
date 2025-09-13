import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, productId, filePath, sku=''] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node assembling/assemble.mjs <productId> <filePath> [sku]');
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const assemblyHash = crypto.createHash('sha256').update(buf).digest('hex');
const assemblyUri  = 'file://' + path.resolve(filePath);

const { gateway, client, contract } = await newGatewayAndContract('Assembler');
try {
  const res = await contract.submitTransaction(
    'Assembler:AssembleProduct',
    productId, assemblyHash, assemblyUri
  );
  printResponse(res);

  // off-chain log -> windows-facade
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'windows-facade');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'Assembling',
    assemblyUri, assemblyHash, sku,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}