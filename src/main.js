// TODO: Move these extensions somewhere else
Creep.prototype.canHeal = function () {
    return this.getActiveBodyparts(HEAL) > 0;
};
Creep.prototype.canAttack = function () {
    return this.getActiveBodyparts(ATTACK) > 0 || this.getActiveBodyparts(RANGED_ATTACK) > 0;
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
 * @param {StructureSpawn|StructureExtension|StructureStorage|StructureContainer} [target] The structure to request energy from
 *
 * @return {number|OK|ERR_NOT_OWNER|ERR_NOT_ENOUGH_RESOURCES|ERR_INVALID_TARGET|ERR_FULL|ERR_NOT_IN_RANGE|ERR_INVALID_ARGS}
 */
Creep.prototype.requestEnergyFrom = function (target) {
    var energyInTarget = _.isNumber(target.energy) ? target.energy :
            target.store && _.isNumber(target.store[RESOURCE_ENERGY]) ? target.store[RESOURCE_ENERGY] : 0;

    if (energyInTarget > 0 && this.room.hasSurplusEnergy()) {
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
/**
 * @returns {boolean} True, if this room has energy available e.g. for building,
 * repairing and upgrading. False, if all the energy is needed for "emergency"
 * actions, e.g. building fighters to fend off hostiles, or replacing dead or
 * soon-to-die worker creeps.
 */
Room.prototype.hasSurplusEnergy = function () {
    if (this.find(FIND_HOSTILE_CREEPS).length > 0) {
        // Busy building fighting creeps!  :)
        return false;
    }

    var energySourceCount = this.find(FIND_SOURCES).length;
    var miners = this.find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.role === ROLE_MINER
    });
    var carriers = this.find(FIND_MY_CREEPS, {
        filter: creep => creep.memory.role === ROLE_CARRIER
    });
    var lowestCreepTickCount = _.min(_.map(miners, 'ticksToLive').concat(_.min(carriers, 'ticksToLive')));

    return miners.length >= energySourceCount && carriers.length >= miners.length && lowestCreepTickCount > 50;
};
/**
 * Makes the creep pick up all energy in the adjacent squares.
 */
Creep.prototype.pickupEnergyInRange = function () {
    if (this.carry.energy < this.carryCapacity) {
        var self = this;
        _.forEach(this.pos.findInRange(FIND_DROPPED_ENERGY, 1), function (resource) {
            self.pickup(resource);
        });
    }
};
/**
 * Transfers resources of the given type to adjacent creeps. If this creep has no
 * resources of the given type, or if no applicable creeps are nearby, does nothing.
 *
 * @param {String} resourceType The type of resource to transfer
 * @param {String|Array} roles Only transfer resources to creeps with the given role.
 * If no value is given, transfers to any adjacent creep
 */
Creep.prototype.transferResourcesToAdjacentCreeps = function (resourceType = RESOURCE_ENERGY, roles = []) {
    if (_.isString(roles)) {
        roles = [roles];
    }

    if (this.carry[resourceType] > 0) {
        var adjacentNonFullCreeps = this.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: creep => (roles.length === 0 || _.includes(roles, creep.memory.role)) &&
            _.sum(creep.carry) < creep.carryCapacity
        });

        var self = this;
        _.forEach(adjacentNonFullCreeps, function (creep) {
            if (self.carry[resourceType] > 0) {
                self.transfer(creep, resourceType);
            }
        })
    }

};
/**
 * Transfers resources of the given type to the adjacent structures that have free
 * capacity. If the creep carries no energy, or if there are no such structures nearby,
 * does nothing. Only transfers resources to neutral structures and structures owned
 * by you.
 *
 * @param {String} resourceType The type of resource to transfer
 * @param {String|Array} ignoreStructureTypes One or more structure types that are ignored by
 * this method (i.e. energy won't be transferred to structures of the given type(s))
 */
Creep.prototype.transferResourcesToAdjacentStructures = function (resourceType = RESOURCE_ENERGY,
                                                                  ignoreStructureTypes = []) {
    if (_.isString(ignoreStructureTypes)) {
        ignoreStructureTypes = [ignoreStructureTypes];
    }

    if (this.carry[resourceType] > 0) {
        var structures = this.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: structure => {
                var type = structure.structureType;
                return !_.includes(ignoreStructureTypes, type) &&
                        structure.canReceiveResources(resourceType) &&
                        (_.isUndefined(structure.my) || structure.my === true)
            }
        });

        var self = this;
        _.forEach(structures, function (structure) {
            if (self.carry[resourceType] > 0) {
                self.transfer(structure, resourceType);
            }
        })
    }
};
/**
 * Determines whether this structure can currently receive resources of the given type.
 *
 * @param {String} resourceType The type of resource that someone is trying to transfer
 * to this structure
 * @returns {boolean} True, if this structure can currently receive at least 1 resource
 * of the given type, false otherwise
 */
Structure.prototype.canReceiveResources = function (resourceType = RESOURCE_ENERGY) {
    return (_.isObject(this.store) && _.isNumber(this.storeCapacity) &&
            _.sum((this.store) < this.storeCapacity)) || (resourceType === RESOURCE_ENERGY &&
            _.isNumber(this.energy) && _.isNumber(this.energyCapacity) &&
            this.energy < this.energyCapacity);
};
/**
 * @returns {boolean} True, if this structure can currently receive at least one unit
 * of energy, false otherwise
 */
Structure.prototype.canReceiveEnergy = function () {
    return this.canReceiveResources(RESOURCE_ENERGY);
};
Structure.prototype.getFromMemory = function (key) {
    this.initMemory();
    return this.memory[key];
};
Structure.prototype.setToMemory = function (key, value) {
    this.initMemory();
    this.memory[key] = value;
};
Structure.prototype.initMemory = function () {
    if (_.isUndefined(this.memory)) {
        if (_.isUndefined(Memory.structures)) {
            Memory.structures = {};
        }
        if (_.isUndefined(Memory.structures[this.id])) {
            Memory.structures[this.id] = {};
        }
        this.memory = Memory.structures[this.id];
    }
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
var towerController = require('./tower');

module.exports.loop = function () {

    _.forEach(Game.spawns, function (spawn) {
        spawnController.run(spawn);
    });

    _.forEach(Game.creeps, function (creep) {
        if (!creep.spawning) {
            Roles[creep.memory.role].run(creep);
        }
    });

    _.forEach(Game.structures, function (structure) {
        if (structure.structureType === STRUCTURE_TOWER) {
            towerController.run(structure);
        }
    });
};