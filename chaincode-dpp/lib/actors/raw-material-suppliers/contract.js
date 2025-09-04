'use strict';

const { Contract } = require('fabric-contract-api');
//const { requireSupplier } = require('../../core/access');
const { assertTransition } = require('../../core/fsm');
const { assertCan } = require('../../core/access');

function txTimeISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);
  return new Date(ms).toISOString();
}

class RawMaterialContract extends Contract {
  constructor() {
    // Namespace per invocazioni: "RawMaterial:Metodo"
    super('RawMaterial');
  }

  // TODO (fase-1): registrare il primo evento per il prodotto
  // Params previsti: productId, rawMatHash, rawMatUri, batchNo
  async RegisterRawMaterial(ctx, productId, rawMatHash, rawMatUri, batchNo ) {
    //requireSupplier(ctx);
    assertCan(ctx, 'RegisterRawMaterial'); 

    if(!productId || !rawMatHash || !rawMatUri) {
      throw new Error('productId, rawMatHash and rawMatUri are required');
    }

    const buf = await ctx.stub.getState(productId);
    if (!buf || !buf.length) throw new Error(`Product ${productId} not found`);
    const product = JSON.parse(buf.toString());
    
    const current = product.currentStage || 'NEW';
    const next = 'RawSupplied';
    if (!assertTransition(current, next)) {
      throw new Error(`Illegal transition: ${current} -> ${next}`);
    }



    const event = {
      seq: (product.events?.length || 0) + 1,
      type: 'RawMaterialSupplied',
      by: ctx.clientIdentity.getMSPID(),
      at: txTimeISO(ctx),
      payload: { rawMatHash, rawMatUri, batchNo }
    };

    
    product.events = product.events || [];
    product.events.push(event);
    product.currentStage = next;

    await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
    await ctx.stub.setEvent('DPP_EVENT', Buffer.from(JSON.stringify({ productId, type: event.type, seq: event.seq })));

    return JSON.stringify({ ok: true, productId, currentStage: product.currentStage });
  }
}

module.exports = RawMaterialContract;
