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

// --- helper per capire se siamo dopo il riciclo
const RECYCLE_OK = new Set(['Recycling', 'Recycled', 'GlassRecycled', 'RecycledGlass', 'recycling']);

// Esegue una evaluate con un'identità specifica (qui Org2) senza “sporcare” il resto
async function withContractAs(mspId, userId, ns, fn) {
  // 👇 MSP corretta
  process.env.MSP_ID = mspId;
  process.env.DISCOVERY_MSP_ID = mspId;

  // 👇 utente/cert da usare per quell’MSP
  process.env.FABRIC_USER = userId;

  process.env.CHANNEL_NAME = process.env.CHANNEL_NAME || 'mychannel';
  process.env.CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'dpp';

  const { gateway, client, contract } = await newGatewayAndContract(ns);
  try { return await fn(contract); }
  finally { gateway.close(); client.close(); }
}

// --- ROUTE “Other Glass Manufacturer” (solo Org2, solo dopo riciclo) -----
app.get('/other/dpp/:id/status', async (req, res) => {
  try {
    const bytes = await withContractAs('Org2MSP','User1@org2.example.com','DppCore',
      c => c.evaluateTransaction('GetProductStatus', req.params.id)
    );
    const st = toJSON(bytes);
    const stage = (st && (st.currentStage || st.stage || st.status)) ?? '';
    if (!RECYCLE_OK.has(String(stage))) {
      return res.status(403).json({ error: 'visible only after recycling stage', currentStage: stage });
    }
    res.json(st);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`DPP public API on :${PORT}`));
