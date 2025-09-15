
'use strict';

const { Contract } = require('fabric-contract-api');
const { assertCan } = require('../../core/access');
const { assertTransition } = require('../../core/fsm');

function txTimeISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const ms = (ts.seconds.low || ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6);
  return new Date(ms).toISOString();
}

class LandFillerContract extends Contract {
    constructor() {super('LandFill')};

    async landFill(ctx, productId, processHash, processUri) {
        assertCan(ctx, 'LandFilling');

        if (!productId || !processHash || !processUri) {
            throw new Error('productId, processHash, processUri are required');
        }

        const buf = await ctx.stub.getState(productId);
        if (!buf?.length) throw new Error(`Product ${productId} not found`);
        const product = JSON.parse(buf.toString());

        const from = product.currentStage || 'NEW';
        const to = 'Landfill';
        if (!assertTransition(from, to)) {
            throw new Error(`Illegal transition: ${from} -> ${to}`);
        }

        const ev = {
            seq: (product.events?.length || 0) + 1,
            type: 'Landfill',
            by: ctx.clientIdentity.getMSPID(),
            at: txTimeISO(ctx),
            payload: { processHash, processUri }
        };

        product.events = product.events || [];
        product.events.push(ev);
        product.currentStage = to;

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
        await ctx.stub.setEvent('DPP_EVENT',
        Buffer.from(JSON.stringify({ productId, type: ev.type, seq: ev.seq })));

        return JSON.stringify({ ok: true, productId, currentStage: product.currentStage });
    }
}

module.exports = LandFillerContract;