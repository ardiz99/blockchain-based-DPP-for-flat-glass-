'use strict';

const ALLOWED = {
  NEW: ['RawSupplied'],
  RawSupplied: ['GlassManufactured'],  
  GlassManufactured: ['GlassManufactured', 'Assembling'], 
  Assembling: ['GlassManufactured', 'Construction'],
  Construction: ['Demolition'],
  Demolition: ['Construction', 'Recycling', 'LandFilled'],
  Recycling: ['Recycling','GlassManufactured']
};

function assertTransition(prev, next) {
  const allowed = ALLOWED[prev] || [];
  return allowed.includes(next);   
}

module.exports = { assertTransition, ALLOWED };