// actors/construction/construct.mjs
import { newGatewayAndContract } from '../../gateway.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, productId, filePath, siteId=''] = process.argv;

const dec = new TextDecoder();
function printResponse(bytes) {
  const txt = Buffer.isBuffer(bytes) || bytes instanceof Uint8Array ? dec.decode(bytes) : String(bytes ?? '');
  try { console.log(JSON.stringify(JSON.parse(txt), null, 2)); }
  catch { console.log(txt); }
}

if (!productId || !filePath) {
  console.error('Usage: node actors/construction/construct.mjs <PRODUCT_ID> <offchain-json-path> [siteID]');
  process.exit(1);
}

// 1) leggi + valida JSON off-chain
const raw = fs.readFileSync(filePath, 'utf8');
let data;
try { data = JSON.parse(raw); }
catch {
  console.error(`Invalid JSON: ${filePath}`);
  process.exit(1);
}

const must = ['installedAt','siteId','building','installer','method'];
for (const k of must) {
  if (!(k in data)) { console.error(`Missing '${k}' in ${filePath}`); process.exit(1); }
}

// installedAt ISO
if (!(typeof data.installedAt === 'string' && !Number.isNaN(Date.parse(data.installedAt)))) {
  console.error(`'installedAt' must be an ISO date string`);
  process.exit(1);
}

// building.{name, (address|gps)}
if (typeof data.building !== 'object' || !data.building) {
  console.error(`'building' must be an object`); process.exit(1);
}
if (typeof data.building.name !== 'string' || !data.building.name.trim()) {
  console.error(`'building.name' required`); process.exit(1);
}
const hasAddress = typeof data.building.address === 'string' && data.building.address.trim();
const hasGps     = Array.isArray(data.building.gps) &&
                   data.building.gps.length === 2 &&
                   data.building.gps.every(n => Number.isFinite(Number(n)));
if (!hasAddress && !hasGps) {
  console.error(`provide at least 'building.address' or 'building.gps' [lat,lon]`);
  process.exit(1);
}

// installer.{company,operatorId}
if (typeof data.installer !== 'object' || !data.installer) {
  console.error(`'installer' must be an object`); process.exit(1);
}
if (typeof data.installer.company !== 'string' || !data.installer.company.trim()) {
  console.error(`'installer.company' required`); process.exit(1);
}
if (typeof data.installer.operatorId !== 'string' || !data.installer.operatorId.trim()) {
  console.error(`'installer.operatorId' required`); process.exit(1);
}

// method
if (typeof data.method !== 'string' || !data.method.trim()) {
  console.error(`'method' must be a non-empty string`); process.exit(1);
}

// 2) calcola hash + uri del file sorgente (tracciabilità)
const processHash = crypto.createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex');
const processUri  = 'file://' + path.resolve(filePath);

// 3) submit on-chain (3 parametri)
const { gateway, client, contract } = await newGatewayAndContract('ConstructionTeam');
try {
  const res = await contract.submitTransaction(
    'ConstructionTeam:constructProduct',
    productId, processHash, processUri
  );
  printResponse(res);

  // 4) salva log off-chain normalizzato
  const outDir = path.join(process.cwd(), 'off-chain-dpp', 'storage', 'construction');
  fs.mkdirSync(outDir, { recursive: true });

  const out = {
    productId,
    stage: 'Construction',
    txAt: new Date().toISOString(),
    processUri, processHash, siteId,

    installedAt: data.installedAt,
    siteId: data.siteId,
    building: {
      name: data.building.name,
      ...(data.building.address ? { address: data.building.address } : {}),
      ...(hasGps ? { gps: [Number(data.building.gps[0]), Number(data.building.gps[1])] } : {})
    },
    installer: {
      company: data.installer.company,
      operatorId: data.installer.operatorId
    },
    warranty: data.warranty,
    maintenanceAdvice: data.maintenanceAdvice,

    method: data.method,
    ...(data.notes ? { notes: data.notes } : {}),
    ...(data.compliance ? { compliance: data.compliance } : {}),
    ...(data.warranty ? { warranty: data.warranty } : {}),
    ...(data.maintenanceAdvice ? { maintenanceAdvice: data.maintenanceAdvice } : {}),

    // opzionali utili, se presenti nel file d’ingresso li riportiamo
    ...(data.tools ? { tools: data.tools } : {}),
    ...(data.sealant ? { sealant: data.sealant } : {}),
    ...(data.fasteners ? { fasteners: data.fasteners } : {}),
    ...(data.photos ? { photos: data.photos } : {}),
    ...(data.orientation ? { orientation: data.orientation } : {}) // es: {azimuthDeg:180, tiltDeg:90}
  };

  const outFile = path.join(outDir, `${productId}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
  console.log('Saved off-chain ->', outFile);
} finally {
  gateway.close();
  client.close();
}
