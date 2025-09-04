'use strict';

// MSP → ruolo
const ROLE_OF_MSP = {
  Org1MSP: 'RawMaterialSupplier',             // o 'Manufacturer' se preferisci
  Org2MSP: 'GlassManufacturer',
  Org3MSP: 'Assembler',
// Org4MSP: 'Assembler',
  // RecyclerMSP: 'Recycler', ...
};

// Azione → ruoli autorizzati
const POLICY = {
  CreateProduct:       ['RawMaterialSupplier'],
  RegisterRawMaterial: ['RawMaterialSupplier'],
  GetStatus:           '*',
  GetHistory:          '*',
  ManufactureGlass:    ['GlassManufacturer'],
  'Assembler:AssembleProduct': ['Assembler'], // con namespace
  AssembleProduct:             ['Assembler'], // senza namespace
};

function getMSP(ctx) { return ctx.clientIdentity.getMSPID(); }
function getRole(ctx) { return ROLE_OF_MSP[getMSP(ctx)] || 'UNKNOWN'; }

function assertCan(ctx, action) {
  const allowed = POLICY[action];
  if (allowed === '*') return;

  const role = getRole(ctx);
  if (!Array.isArray(allowed) || !allowed.includes(role)) {
    throw new Error(`Access denied for ${action}. role=${role}, required=${JSON.stringify(allowed)}`);
  }
}

module.exports = { assertCan, getRole, getMSP, ROLE_OF_MSP, POLICY };
