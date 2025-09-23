// actors/building-owners/view.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { newGatewayAndContract } from '../../gateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toJSON(bytes) {
  try {
    const buf = Buffer.isBuffer(bytes)
      ? bytes
      : (bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(String(bytes ?? ''), 'utf8'));
    const txt = buf.toString('utf8').trim();
    return JSON.parse(txt);
  } catch {
    // utile per capire cosa è arrivato in caso di problemi
    return { raw: Buffer.isBuffer(bytes) ? bytes.toString('utf8') :
             (bytes instanceof Uint8Array ? Buffer.from(bytes).toString('utf8') : String(bytes ?? '')) };
  }
}

/**
 * Cerca prima FG-<id>.json, poi il più recente FG-<id>-<timestamp>.json
 */
function pickConstructionFile(dir, productId) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return null;

  const flat = path.join(abs, `${productId}.json`);
  if (fs.existsSync(flat)) return flat;

  const prefix = `${productId}-`;
  const candidates = fs.readdirSync(abs)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .map(f => ({ f, mtime: fs.statSync(path.join(abs, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return candidates.length ? path.join(abs, candidates[0].f) : null;
}

async function main() {
  const [, , productId, offchainDirArg] = process.argv;
  if (!productId) {
    console.error('usage: node actors/building-owners/view.mjs <PRODUCT_ID> [OFFCHAIN_DIR]');
    process.exit(1);
  }

  // default env (puoi sempre override via MSP_ID, DISCOVERY_MSP_ID, ecc.)
  process.env.MSP_ID = process.env.MSP_ID || 'Org3MSP';
  process.env.DISCOVERY_MSP_ID = process.env.DISCOVERY_MSP_ID || 'Org1MSP';
  process.env.CHANNEL_NAME = process.env.CHANNEL_NAME || 'mychannel';
  process.env.CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'dpp';

  const { gateway, client, contract } = await newGatewayAndContract('DppCore');
  try {
    // compatibilità doppio nome metodo
    let statusBytes;
    try {
      statusBytes = await contract.evaluateTransaction('GetProductStatus', productId);
    } catch {
      statusBytes = await contract.evaluateTransaction('GetStatus', productId);
    }
    const status = toJSON(statusBytes);

    const allowedStages = new Set(['Construction', 'Demolition', 'Recycling', 'Landfill']);
    if (!status || !status.currentStage || !allowedStages.has(status.currentStage)) {
      console.log(JSON.stringify({
        error: 'visible only from Construction stage onward',
        currentStage: status?.currentStage ?? 'UNKNOWN',
      }, null, 2));
      return;
    }

    // cartella off-chain configurabile
    const defaultDir = path.resolve(__dirname, '../../..', 'off-chain-dpp/storage/construction');
    const offchainDir = offchainDirArg || process.env.OFFCHAIN_DIR || defaultDir;

    const filePath = pickConstructionFile(offchainDir, productId);
    if (!filePath) {
      console.log(JSON.stringify({
        ok: true,
        productId,
        currentStage: status.currentStage,
        warning: 'no construction off-chain file found',
        lookedIn: offchainDir,
        expected: [`${productId}.json`, `${productId}-<timestamp>.json`],
      }, null, 2));
      return;
    }

    let construction;
    try {
      construction = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.log(JSON.stringify({
        ok: true,
        productId,
        currentStage: status.currentStage,
        warning: `failed to parse off-chain JSON: ${e.message}`,
        source: { offchainFile: filePath },
      }, null, 2));
      return;
    }

    const warranty = construction.warranty ?? {};
    const maintenance = construction.maintenance ?? construction.maintenanceAdvice ?? {};
    const nextServiceDue =
      maintenance.nextServiceDate ||
      maintenance.next_due ||
      (Array.isArray(maintenance.schedule) ? maintenance.schedule[0]?.dueDate : null) ||
      null;

    const installedAt = construction.installation?.date ?? construction.installedAt ?? null;
    const building    = construction.installation?.site ?? construction.building ?? null;

    console.log(JSON.stringify({
      ok: true,
      productId,
      currentStage: status.currentStage,
      installedAt,
      building,
      warranty,
      maintenance,
      nextServiceDue,
      source: { offchainFile: filePath, searchedIn: offchainDir },
    }, null, 2));
  } finally {
    gateway.close();
    client.close();
  }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }, null, 2));
  process.exit(1);
});
