import { newGatewayAndContract } from '../gateway.js';

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

const [,, productId, meta='{}'] = process.argv;
if (!productId) {
  console.error('Usage: node client-dpp/core/createProduct.mjs <productId> [<metaJson>]');
  process.exit(1);
}

const { gateway, client, contract } = await newGatewayAndContract();
try {
  const res = await contract.submitTransaction('DppCore:CreateProduct', productId, meta);
  printResponse(res);
} finally { gateway.close(); client.close(); }
