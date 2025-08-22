//the core part of the DPP: 
// 1) create a product: first thing to do, 
// 2) get the product status: update the status of a product
// 3) get the history of a product

'use strict';

const { Contract } = require('fabric-contract-api');
const { assertCan } = require('./access'); 

function txTimeISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);
  return new Date(ms).toISOString();
}

class DppCoreContract extends Contract {
  constructor() {
    // Nome del namespace (per invocarlo: "DppCore:Metodo")
    super('DppCore');
  }

  // TODO (fase-1): crea il contenitore prodotto
  async CreateProduct(ctx, productId, metaJson) {
    
    assertCan(ctx, 'CreateProduct');
    if (!productId) throw new Error('productId is required');

    const exists = await ctx.stub.getState(productId);
    if (exists && exists.length) {
      throw new Error(`Product ${productId} already exists`);
    }

    let meta = {};
    try { meta = JSON.parse(metaJson || '{}'); }
    catch { throw new Error('metaJson must be valid JSON'); }

    const product = {
      id: productId,
      meta,
      currentStage: 'NEW',
      createdBy: ctx.clientIdentity.getMSPID(),
      createdAt: txTimeISO(ctx),
      events: []
    };

    await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
    await ctx.stub.setEvent('DPP_EVENT', Buffer.from(JSON.stringify({ productId, type: 'CreateProduct' })));
    return JSON.stringify(product);
  }

  // TODO (fase-1): stato corrente (stage + ultimo evento)
  async GetProductStatus(ctx, productId) {
    assertCan(ctx, 'GetStatus');
    const buf = await ctx.stub.getState(productId);
    if (!buf || !buf.length) throw new Error(`Product ${productId} not found`);
    const p = JSON.parse(buf.toString());
    const lastEvent = p.events && p.events.length ? p.events[p.events.length - 1] : null;
    return JSON.stringify({ id: p.id, currentStage: p.currentStage, lastEvent });
  }

  // TODO (fase-1): audit trail completo
  async GetHistory(ctx, productId) {
    assertCan(ctx, 'GetHistory');
    const iter = await ctx.stub.getHistoryForKey(productId);
    const out = [];

    try {
      // l'iterator NON è async-iterable: usa next()/done
      while (true) {
        const res = await iter.next();
        if (res.value) {
          const km = res.value; // KeyModification
          const ts = km.timestamp;
          const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);

          out.push({
            txId: km.txId,
            timestamp: new Date(ms).toISOString(),
            isDelete: km.isDelete,
            value: km.value ? JSON.parse(km.value.toString('utf8')) : null,
          });
        }
        if (res.done) break;
      }
    } finally {
      try { await iter.close(); } catch (_) {}
    }

    return JSON.stringify(out);
  }
}

module.exports = DppCoreContract;
