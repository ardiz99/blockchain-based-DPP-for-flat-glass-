import { newGatewayAndContract } from '../gateway.js';

const [,, productId] = process.argv;

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

if (!productId) { console.error('Usage: node client-dpp/core/getStatus.mjs <productId>'); process.exit(1); }
const { gateway, client, contract } = await newGatewayAndContract();
try {
  const res = await contract.evaluateTransaction('DppCore:GetProductStatus', productId);
  printResponse(res);
} finally { gateway.close(); client.close(); }
