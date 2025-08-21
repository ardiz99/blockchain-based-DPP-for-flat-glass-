//this represent the life cycle of a product
//it's build like the finite state machine

'use strict';

const ALLOWED = {
  NEW: ['RawSupplied'],
  RawSupplied: []
};

// TODO: macchina a stati minima Fase-1
// allowed: NEW -> RawSupplied
// function assertTransition(prev, next) { ... }

function assertTransition(prev, next) {
  const allowed = ALLOWED[prev] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Illegal transition: ${prev} -> ${next}`);
  }
}

module.exports = {assertTransition};
