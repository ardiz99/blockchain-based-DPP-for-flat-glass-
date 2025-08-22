'use strict';

const ALLOWED = {
  NEW: ['RawSupplied'],
  RawSupplied: ['GlassManufactured'],  
  GlassManufactured: ['GlassManufactured', 'Assembling'], // loop + transizione ad Assembling
  Assembling: [],
};

function assertTransition(prev, next) {
  const allowed = ALLOWED[prev] || [];
  return allowed.includes(next);   
}

module.exports = { assertTransition, ALLOWED };