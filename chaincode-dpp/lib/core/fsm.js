'use strict';

const ALLOWED = {
  NEW: ['RawSupplied'],
  RawSupplied: ['GlassManufactured'],  
  GlassManufactured: ['GlassManufactured', 'Assembling'], 
  Assembling: ['GlassManufactured', 'Construction'],
  Construction: ['Demolition'],
};

function assertTransition(prev, next) {
  const allowed = ALLOWED[prev] || [];
  return allowed.includes(next);   
}

module.exports = { assertTransition, ALLOWED };