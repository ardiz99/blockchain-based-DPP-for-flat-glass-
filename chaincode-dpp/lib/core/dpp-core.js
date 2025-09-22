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

function get(o, path) {
  return path.split('.').reduce((v, k) => (v && v[k] !== undefined ? v[k] : undefined), o);
}

function defaultComplianceRules() {
  return [
    
    { id: 'RM-1', when: 'RawMaterialRegistered', require: ['payload.batchNo'] },
    { id: 'FG-1', when: 'GlassManufactured',      require: ['payload.processUri','payload.batchNo','payload.furnaceId'] },
    { id: 'ASM-1', when: 'Assembled',             require: ['payload.specUri'] },
    { id: 'CON-1', when: 'Construction',          require: ['payload.siteId'] },
    { id: 'DEM-1', when: 'Demolition',            require: ['payload.recoveryPotential.recommendedPath'] },
    { id: 'REC-1', when: 'Recycling',             require: ['payload.outputs'] },
    { id: 'LF-1',  when: 'Landfilled',            require: ['payload.reasonForDisposal'] },
  ];
}

function computeCompliance(product, rules) {
  const events = Array.isArray(product.events) ? product.events : [];
  const checks = rules.map(rule => {
    const ev = events.find(e => e.type === rule.when);
    if (!ev) {
      return { id: rule.id, when: rule.when, pass: false, reason: `no ${rule.when} event` };
    }
    for (const f of (rule.require || [])) {
      if (get(ev, f) === undefined) {
        return { id: rule.id, when: rule.when, pass: false, reason: `missing field ${f}` };
      }
    }
    return { id: rule.id, when: rule.when, pass: true };
  });
  const ok = checks.every(c => c.pass);
  return { ok, checks };
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

  async EvaluateCompliance(ctx, productId, rulesJson) {
    assertCan(ctx, 'EvaluateCompliance');
    if (!productId) throw new Error('productId is required');

    const buf = await ctx.stub.getState(productId);
    if (!buf || !buf.length) throw new Error(`Product ${productId} not found`);
    const product = JSON.parse(buf.toString());

    let rules = defaultComplianceRules();
    if (rulesJson) {
      try { rules = JSON.parse(rulesJson); }
      catch { throw new Error('rulesJson must be valid JSON'); }
    }

    const result = computeCompliance(product, rules);
    return JSON.stringify({
      productId,
      currentStage: product.currentStage,
      ...result
    });
  }
}

module.exports = DppCoreContract;
