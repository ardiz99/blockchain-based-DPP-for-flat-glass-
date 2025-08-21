import { newGatewayAndContract } from '../gateway.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [,, productId, filePath, batchNo=''] = process.argv;

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
  console.error('Usage: node client-dpp/raw-material/register.mjs <productId> <filePath> [batchNo]');
  process.exit(1);
}

const buf  = fs.readFileSync(filePath);
const hash = crypto.createHash('sha256').update(buf).digest('hex');
const uri  = 'file://' + path.resolve(filePath);

const { gateway, client, contract } = await newGatewayAndContract();
try {
  const res = await contract.submitTransaction('RawMaterial:RegisterRawMaterial', productId, hash, uri, batchNo);
  printResponse(res);
} finally { gateway.close(); client.close(); }
