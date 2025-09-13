import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath, siteId=''] = process.argv;

const dec = new TextDecoder();
const printResponse = (bytes) => {
  const txt = dec.decode(bytes);
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
};

if (!productId || !filePath) {
  console.error('Usage: node construction/construct.mjs -- <productId> <offchain-json-path> [siteId]');
  process.exit(1);
}

const buf = fs.readFileSync(filePath);
const productHash = crypto.createHash('sha256').update(buf).digest('hex');
const productUri  = 'file://' + path.resolve(filePath);

const { gateway, client, contract } = await newGatewayAndContract('ConstructionTeam');
try {
  const res = await contract.submitTransaction(
    'ConstructionTeam:constructProduct',
    productId, productHash, productUri
  );
  printResponse(res);

  // off-chain log -> construction
  const dir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'construction');
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    productId,
    stage: 'Constructed',
    productUri, productHash, siteId,
    txAt: new Date().toISOString()
  };
  const f = path.join(dir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', f);
} finally {
  gateway.close(); client.close();
}