import { newGatewayAndNetwork } from '../gateway.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const chaincodeName = process.env.CHAINCODE_NAME || 'dpp';
const onlyProduct   = process.env.PRODUCT || '';     // es. PRODUCT=FG-2025-0001
const RESET_LOG     = process.env.RESET_LOG === '1'; // es. RESET_LOG=1 npm run listen
const START_MODE    = process.env.START || 'latest'; // 'latest' | 'zero' | numero (es. '0' o '5')

const dec = new TextDecoder();

const outDir   = path.resolve('../off-chain-dpp/events-log');
const dayTag   = new Date().toISOString().substring(0, 10);
const filePath = path.join(outDir, `events-${dayTag}.jsonl`);
//resetta il file dei log ogni volta che riavvii
async function ensureCleanLogDir() {
  await fs.mkdir(outDir, { recursive: true });
  if (RESET_LOG) {
    const files = await fs.readdir(outDir);
    await Promise.all(files.map(f => fs.rm(path.join(outDir, f), { force: true })));
  }
}

// Determina le opzioni per getChaincodeEvents SENZA usare getBlockHeight()
function getEventStreamOptions() {
  // latest (default): nessun startBlock => parte dal più recente
  if (START_MODE === 'latest') return undefined;

  // zero: dal genesis (0n)
  if (START_MODE === 'zero') return { startBlock: 0n };

  // numero esplicito
  if (/^\d+$/.test(START_MODE)) return { startBlock: BigInt(START_MODE) };

  // fallback: latest
  return undefined;
}

const { gateway, client, network } = await newGatewayAndNetwork();
await ensureCleanLogDir();

try {
  const options = getEventStreamOptions();
  const events = await network.getChaincodeEvents(chaincodeName, options);

  console.log(`🎧 Listening "${chaincodeName}" events ${options?.startBlock !== undefined ? `from block ${options.startBlock}` : '(from latest)'} … Ctrl+C per uscire`);
  if (onlyProduct) console.log(`   filtro prodotto: ${onlyProduct}`);
  if (RESET_LOG)   console.log(`   log directory pulita: ${outDir}`);

  for await (const evt of events) {
    if (evt.eventName !== 'DPP_EVENT') continue;

    const txt = dec.decode(evt.payload);
    let body = null;
    try { body = JSON.parse(txt); } catch { body = { raw: txt }; }

    if (onlyProduct && body.productId !== onlyProduct) continue;

    const record = {
      blockNumber: evt.blockNumber?.toString?.() ?? '',
      txId: evt.transactionId,
      eventName: evt.eventName,
      ...body
    };

    console.log('— — — — — — — — — —');
    console.log(`⛓️  block: ${record.blockNumber}  tx: ${record.txId}`);
    console.log(`📢  ${record.eventName}:`);
    console.log(JSON.stringify(body, null, 2));

    await fs.appendFile(filePath, JSON.stringify(record) + '\n', 'utf8');
  }
} finally {
  gateway.close();
  client.close();
}

process.stdin.resume();
process.on('SIGINT', () => {
  console.log('\n👋 stop listener');
  process.exit(0);
});
