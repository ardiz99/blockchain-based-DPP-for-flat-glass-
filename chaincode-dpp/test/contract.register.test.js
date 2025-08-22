const chai = require('chai');
//const chaiAsPromised = require('chai-as-promised');
//chai.use(chaiAsPromised);
const { makeCtx } = require('./helpers/mockCtx');
const RawMaterialContract = require('../lib/actors/raw-material-suppliers/contract'); // adatta il path

const { expect } = require('chai-as-promised');

describe('RegisterRawMaterial', () => {
  let contract;
  beforeEach(() => { contract = new RawMaterialContract('raw'); });

  it('blocca Org1MSP (RBAC)', async () => {
    const ctx = makeCtx({ msp: 'Org1MSP' });
    await expect(contract.RegisterRawMaterial(ctx, 'P-1', JSON.stringify({ batchNo:'B1', rawMatUri:'file:///x' })))
      .to.be.rejectedWith(/Access denied|Only|not authorized/i);
  });

  it('errore se product non esiste', async () => {
    const ctx = makeCtx({ msp: 'Org2MSP' });
    await expect(contract.RegisterRawMaterial(ctx, 'P-404', JSON.stringify({ batchNo:'B1', rawMatUri:'file:///x' })))
      .to.be.rejectedWith(/not found/i);
  });

  it('errore payload invalido (manca batchNo e hash/uri)', async () => {
    const ctx = makeCtx({
      msp: 'Org2MSP',
      state: { 'P-1': { id: 'P-1', currentStage: 'NEW', events: [] } }
    });
    await expect(contract.RegisterRawMaterial(ctx, 'P-1', JSON.stringify({})))
      .to.be.rejectedWith(/batchNo|rawMatHash|rawMatUri/i);
  });

  it('ok: NEW → RawSupplied, salva stato ed emette evento', async () => {
    const ctx = makeCtx({
      msp: 'Org2MSP',
      state: { 'P-1': { id:'P-1', currentStage:'NEW', events:[] } }
    });
    const res = await contract.RegisterRawMaterial(ctx, 'P-1', JSON.stringify({ batchNo:'B1', rawMatUri:'file:///x' }));
    expect(res).to.be.a('string');

    const saved = JSON.parse(ctx._kv.get('P-1').toString());
    expect(saved.currentStage).to.equal('RawSupplied');
    expect(saved.events).to.have.length(1);
    expect(saved.events[0]).to.include({ type: 'RawMaterialSupplied' });

    // ha emesso un evento?
    expect(ctx.stub.setEvent.calledOnce).to.equal(true);
  });

  it('rifiuta duplicato stesso batch (se hai compositeKey anti-dup)', async () => {
    const ctx = makeCtx({
      msp: 'Org2MSP',
      state: { 'P-1': { id:'P-1', currentStage:'NEW', events:[] } }
    });
    await contract.RegisterRawMaterial(ctx, 'P-1', JSON.stringify({ batchNo:'B1', rawMatUri:'file:///x' }));
    // Simula che la compositeKey sia marcata (se non lo fai già dentro il metodo)
    // ctx._kv.set('rm~product~batch:P-1:B1', Buffer.from('1'));

    await expect(contract.RegisterRawMaterial(ctx, 'P-1', JSON.stringify({ batchNo:'B1', rawMatUri:'file:///x' })))
      .to.be.rejectedWith(/already registered|duplicate/i);
  });
});
