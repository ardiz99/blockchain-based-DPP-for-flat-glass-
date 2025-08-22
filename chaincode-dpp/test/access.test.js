const { expect } = require('chai');
// Adatta il path al tuo access.js e alle export reali:
const { assertCan } = require('../lib/core/access');

const ctxOf = (msp) => ({ clientIdentity: { getMSPID: () => msp } });

describe('RBAC (access.js)', () => {
  it('Org1 può CreateProduct', () => {
    expect(() => assertCan(ctxOf('Org1MSP'), 'CreateProduct')).to.not.throw();
  });
  it('Org2 NON può CreateProduct', () => {
    expect(() => assertCan(ctxOf('Org2MSP'), 'CreateProduct')).to.throw(/Access denied/i);
  });
  it('Org2 può RegisterRawMaterial', () => {
    expect(() => assertCan(ctxOf('Org2MSP'), 'RegisterRawMaterial')).to.not.throw();
  });
  it('GetStatus è aperto a tutti (*)', () => {
    expect(() => assertCan(ctxOf('QualunqueMSP'), 'GetStatus')).to.not.throw();
  });
});
