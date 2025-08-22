const sinon = require('sinon');

function makeCtx({ msp = 'Org2MSP', state = {} } = {}) {
  // stato fittizio ledger in-memory
  const kv = new Map(Object.entries(state).map(([k, v]) => [k, Buffer.from(JSON.stringify(v))]));

  const stub = {
    getState: sinon.stub().callsFake(async (key) => kv.get(key) || Buffer.alloc(0)),
    putState: sinon.stub().callsFake(async (key, val) => { kv.set(key, Buffer.from(val)); }),
    setEvent: sinon.stub().resolves(),
    createCompositeKey: sinon.stub().callsFake((objType, attrs) => `${objType}:${attrs.join(':')}`),
  };

  const clientIdentity = { getMSPID: () => msp };
  return { stub, clientIdentity, _kv: kv }; // _kv utile per ispezionare
}

module.exports = { makeCtx };
