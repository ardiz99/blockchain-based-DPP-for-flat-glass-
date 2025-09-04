'use strict';

const { Contract } = require('fabric-contract-api');
const { assertCan } = require('../../core/access');
const { assertTransition } = require('../../core/fsm');

function txTimeISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);
  return new Date(ms).toISOString();
}

class AssemblerContract extends Contract {
  constructor() { super('Assembler'); }

  // Nessun specJson: firma semplice e stabile
  async AssembleProduct(ctx, productId, assemblyHash, assemblyUri, sku = '') {
    assertCan(ctx, 'AssembleProduct');

    if (!productId || !assemblyHash || !assemblyUri) {
      throw new Error('productId, assemblyHash, assemblyUri are required');
    }

    const buf = await ctx.stub.getState(productId);
    if (!buf?.length) throw new Error(`Product ${productId} not found`);
    const product = JSON.parse(buf.toString());

    const from = product.currentStage || 'NEW';
    const to = 'Assembling';
    if (!assertTransition(from, to)) {
      throw new Error(`Illegal transition: ${from} -> ${to}`);
    }

    const ev = {
      seq: (product.events?.length || 0) + 1,
      type: 'Assembled',
      by: ctx.clientIdentity.getMSPID(),
      at: txTimeISO(ctx),
      payload: { assemblyHash, assemblyUri, sku }
    };

    product.events = product.events || [];
    product.events.push(ev);
    product.currentStage = to;

    // opzionale: promuovi il tipo a "window" (puoi commentarlo se non vuoi)
    product.meta = product.meta || {};
    product.meta.type = 'window';

    await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
    await ctx.stub.setEvent('DPP_EVENT', Buffer.from(JSON.stringify({ productId, type: ev.type, seq: ev.seq })));
    return JSON.stringify({ ok: true, productId, currentStage: product.currentStage });
  }
}

module.exports = AssemblerContract;
