'use strict';

function requireSupplier(ctx) {
  const msp = ctx.clientIdentity.getMSPID();
  const allowed = ['RawMaterialSupplierMSP', 'Org1MSP']; // ← lascia Org1MSP per i test
  if (!allowed.includes(msp)) {
    throw new Error(`Only Raw Material Supplier can perform this action. Got MSP=${msp}`);
  }
}

module.exports = { requireSupplier };
