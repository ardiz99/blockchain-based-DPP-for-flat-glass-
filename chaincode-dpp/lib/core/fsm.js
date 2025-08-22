'use strict';

const ALLOWED = {
  NEW: ['RawSupplied'],
  RawSupplied: []
};

function assertTransition(prev, next) {
  const allowed = ALLOWED[prev] || [];
  return allowed.includes(next);   
}

module.exports = { assertTransition, ALLOWED };