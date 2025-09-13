'use strict';

// Core DPP (API generiche)
const DppCoreContract = require('./lib/core/dpp-core');

// Attore: Raw Material Supplier (path come nella tua struttura)
const RawMaterialContract = require('./lib/actors/raw-material-suppliers/contract');

const GlassManufacturerContract = require('./lib/actors/glass-manufacturer/contract');

const AssemblerContract = require('./lib/actors/facade-maker/contract');

const ConstructionContract = require('./lib/actors/construction-team/contract')

// Un solo chaincode package che espone più Contract (namespace separati)
module.exports.contracts = [ DppCoreContract, RawMaterialContract, GlassManufacturerContract, AssemblerContract, ConstructionContract ];
