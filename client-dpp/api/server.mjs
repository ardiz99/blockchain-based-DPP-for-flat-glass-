import express from 'express';
import { newGatewayAndContract } from '../gateway.js';

const app = express();
const PORT = process.env.PORT || 8080;

function toJSON(bytes) {
  if (bytes == null) return null;

  let txt;
  if (Buffer.isBuffer(bytes)) {
    txt = bytes.toString('utf8');
  } else if (bytes instanceof Uint8Array) {
    // decode correttamente un Uint8Array
    txt = new TextDecoder('utf-8').decode(bytes);
  } else if (typeof bytes === 'string') {
    txt = bytes;
  } else {
    // fallback prudente
    try { txt = Buffer.from(bytes).toString('utf8'); }
    catch { txt = String(bytes); }
  }

  try { return JSON.parse(txt); }
  catch { return { raw: txt }; }
}

async function withContract(ns, fn) {
  process.env.MSP_ID = process.env.MSP_ID || 'Org1MSP';
  process.env.DISCOVERY_MSP_ID = process.env.DISCOVERY_MSP_ID || 'Org1MSP';
  process.env.CHANNEL_NAME = process.env.CHANNEL_NAME || 'mychannel';
  process.env.CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'dpp';

  const { gateway, client, contract } = await newGatewayAndContract(ns);
  try { return await fn(contract); }
  finally { gateway.close(); client.close(); }
}

app.get('/dpp/:id/status', async (req, res) => {
  try {
    // usa il namespace DppCore e la funzione senza prefisso
    const bytes = await withContract('DppCore', c => c.evaluateTransaction('GetProductStatus', req.params.id));
    res.json(toJSON(bytes));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/dpp/:id/history', async (req, res) => {
  try {
    const bytes = await withContract('DppCore', c => c.evaluateTransaction('GetHistory', req.params.id));
    res.json(toJSON(bytes));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`DPP public API on :${PORT}`));
