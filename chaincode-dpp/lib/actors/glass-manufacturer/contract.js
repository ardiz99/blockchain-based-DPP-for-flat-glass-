
'use strict';

const { Contract } = require('fabric-contract-api');
const { assertTransition } = require('../../core/fsm');
const { assertCan } = require('../../core/access');

function txTimeISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);
  return new Date(ms).toISOString();
}

class GlassManufacturerContract extends Contract {
  constructor() {
    super('GlassManufacturer');
  }

  /**
   * productId: ID del prodtto creato in DppCore
   * processHash: SHA256 del report/process sheet off-chain
   * processUri: URI (ipfs/s3/http/…) del report/process sheet
   * batchNo, furnaceId, culletRatio: metadati opzionali
   */o
  // lib/actors/flat-glass/contract.js (estratto)
  async ManufactureGlass(ctx, productId, processHash, processUri, batchNo, furnaceId, culletRatio, inputsJson='[]') {
    assertCan(ctx, 'ManufactureGlass');

    const buf = await ctx.stub.getState(productId);
    if (!buf || !buf.length) throw new Error(`Product ${productId} not found`);
    const product = JSON.parse(buf.toString());

    const next = 'GlassManufactured';
    if (!assertTransition(product.currentStage || 'NEW', next)) {
      throw new Error(`Illegal transition: ${product.currentStage} -> ${next}`);
    }

    // inputs = [{hash:"<rawMatHash>"}] oppure [{seq:2}]
    let inputs = [];
    try { inputs = JSON.parse(inputsJson || '[]'); } catch { throw new Error('inputsJson must be JSON'); }

    // Verifica che i riferimenti puntino a RawMaterialSupplied esistenti
    const rawEvents = (product.events || []).filter(e => e.type === 'RawMaterialSupplied');
    for (const ref of inputs) {
      const ok = ref.hash
        ? rawEvents.some(e => e.payload?.rawMatHash === ref.hash)
        : Number.isInteger(ref.seq) && rawEvents.some(e => e.seq === ref.seq);
      if (!ok) throw new Error('Referenced raw material not found in this product');
    }

    const event = {
      seq: (product.events?.length || 0) + 1,
      type: 'GlassManufactured',
      by: ctx.clientIdentity.getMSPID(),
      at: txTimeISO(ctx),
      payload: {
        processHash, processUri, batchNo, furnaceId, culletRatio,
        inputs        // lega esplicitamente ai raw materials usati
      }
    };

    product.events = product.events || [];
    product.events.push(event);
    product.currentStage = next;

    product.meta = product.meta || {};
    product.meta.type = 'flat-glass';
    
    await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
    await ctx.stub.setEvent('DPP_EVENT', Buffer.from(JSON.stringify({ productId, type: event.type, seq: event.seq })));
    return JSON.stringify({ ok: true, productId, currentStage: product.currentStage });
  }

}

module.exports = GlassManufacturerContract;
