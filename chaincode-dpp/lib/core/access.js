'use strict';

// MSP → ruoli (multipli ammessi)
const ROLE_OF_MSP = {
  Org1MSP: ['RawMaterialSupplier'],
  Org2MSP: ['GlassManufacturer'],
  Org3MSP: ['Assembler', 'ConstructionTeam', 'DemolitionTeam', 'GlassRecycler', 'LandFiller'], // Org3 "simula" entrambi i ruoli
  // Org4MSP: [...],
};

// Azione → ruoli autorizzati (array o '*')
const POLICY = {
  CreateProduct:       ['RawMaterialSupplier'],
  RegisterRawMaterial: ['RawMaterialSupplier'],
  GetStatus:           '*',
  GetHistory:          '*',
  ManufactureGlass:    ['GlassManufacturer'],
  AssembleProduct:     ['Assembler'],
  Construction:        ['ConstructionTeam'],
  Demolition:          ['DemolitionTeam'],
  Recycling:           ['GlassRecycler'],
  LandFilling:         ['LandFiller'],
};

function getMSP(ctx) {
  return ctx.clientIdentity.getMSPID();
}

function getRoles(ctx) {
  return ROLE_OF_MSP[getMSP(ctx)] || [];
}

function assertCan(ctx, action) {
  const allowed = POLICY[action];
  if (allowed === '*') return;

  const roles = getRoles(ctx);
  const ok = roles.some(r => allowed.includes(r));
  if (!ok) {
    throw new Error(
      `Access denied for ${action}. msp=${getMSP(ctx)}, roles=${JSON.stringify(roles)}, required=${JSON.stringify(allowed)}`
    );
  }
}

module.exports = { assertCan, getMSP, getRoles, ROLE_OF_MSP, POLICY };
