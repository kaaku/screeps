// TODO: Move these extensions somewhere else
Creep.prototype.canHeal = function () {
    return this.getActiveBodyparts(HEAL) > 0;
};
Creep.prototype.log = function (message) {
    console.log(`${this.name} (${this.memory.role}): ${message}`);
};
/**
 * Make the creep request for energy from the given spawn or extension.
 * If the room has very scarce energy reserves at the moment, and the
 * energy has to be used to build new creeps, no energy will be given
 * to the creep. Otherwise the maximum amount will be transferred.
 *
 * @type {function}
 *
 * @param {StructureSpawn|StructureExtension|StructureStorage|StructureContainer} [target] The structure to request energy from
 *
 * @return {number|OK|ERR_NOT_OWNER|ERR_NOT_ENOUGH_RESOURCES|ERR_INVALID_TARGET|ERR_FULL|ERR_NOT_IN_RANGE|ERR_INVALID_ARGS}
 */
Creep.prototype.requestEnergyFrom = function (target) {
    var energySourceCount = this.room.find(FIND_SOURCES).length;
    var miners = this.room.find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.role === ROLE_MINER
    });
    var carriers = this.room.find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.role === ROLE_CARRIER
    });
    var lowestCreepTickCount = _.min(_.map(miners, 'ticksToLive').concat(_.min(carriers, 'ticksToLive')));
    var energyInTarget = _.isNumber(target.energy) ? target.energy :
            target.store && _.isNumber(target.store[RESOURCE_ENERGY]) ? target.store[RESOURCE_ENERGY] : 0;

    if (energyInTarget > 0 && miners.length >= energySourceCount && lowestCreepTickCount > 50) {
        if (typeof target.transfer === 'function') {
            return target.transfer(this, RESOURCE_ENERGY);
        } else if (typeof target.transferEnergy === 'function') {
            return target.transferEnergy(this);
        } else {
            return ERR_INVALID_TARGET;
        }
    }

    return ERR_NOT_ENOUGH_ENERGY;
};

global.ROLE_HARVESTER = 'harvester';
global.ROLE_MINER = 'miner';
global.ROLE_CARRIER = 'carrier';
global.ROLE_BUILDER = 'builder';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';

global.Roles = {
    harvester: require('./role.harvester'),
    miner: require('./role.miner'),
    carrier: require('./role.carrier'),
    builder: require('./role.builder'),
    soldierMelee: require('./role.soldier_melee'),
    soldierMedic: require('./role.soldier_medic')
};

var _ = require('lodash');
var spawnController = require('./spawn');

module.exports.loop = function () {

    _.forEach(Game.spawns, function (spawn) {
        spawnController.run(spawn);
    });

    _.forEach(Game.creeps, function (creep) {
        if (!creep.spawning) {
            Roles[creep.memory.role].run(creep);
        }
    });
};