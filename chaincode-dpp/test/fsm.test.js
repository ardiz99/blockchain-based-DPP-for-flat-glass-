const { expect } = require('chai');
// Adatta il path/esportazione reale del tuo fsm:
const { assertTransition } = require('../lib/core/fsm'); 

describe('FSM: product lifecycle', () => {
  it('NEW → RawSupplied è valido', () => {
    const ok = assertTransition('NEW', 'RawSupplied');
    expect(ok).to.be.true;
  });

  it('RawSupplied → NEW non è valido', () => {
    const ok = assertTransition('RawSupplied', 'NEW');
    expect(ok).to.be.false;
  });

  it('Stato sconosciuto → evento non valido', () => {
    const ok = assertTransition('XXX', 'RawSupplied');
    expect(ok).to.be.false;
  });
});
