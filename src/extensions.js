var _ = require('lodash');
var utils = require('./utils');


/**
 * @returns {boolean} True, if the creep can currently attack (i.e. has functioning
 * ATTACK body parts), false otherwise
 */
Creep.prototype.canAttack = function () {
    return this.getActiveBodyparts(ATTACK) > 0 || this.getActiveBodyparts(RANGED_ATTACK) > 0;
};

/**
 * @returns {boolean} True, if the creep can currently heal (i.e. has functioning
 * HEAL body parts), false otherwise
 */
Creep.prototype.canHeal = function () {
    return this.getActiveBodyparts(HEAL) > 0;
};

/**
 * @returns {boolean} True, if the creep can currently move (i.e. has functioning
 * MOVE body parts), false otherwise
 */
Creep.prototype.canMove = function () {
    return this.getActiveBodyparts(MOVE) > 0;
};

/**
 * @returns {number} A numeric value that gives an indication of how much attack/heal
 * potential this creep has.
 */
Creep.prototype.getFightingStrength = function () {
    return this.getActiveBodyparts(ATTACK) * ATTACK_POWER +
            this.getActiveBodyparts(RANGED_ATTACK) * RANGED_ATTACK_POWER +
            this.getActiveBodyparts(HEAL) * (HEAL_POWER + RANGED_HEAL_POWER) / 2;
};

/**
 * @returns {RoomPosition} The position in a room to be occupied where the attackers
 * move towards (until they find hostiles to engage)
 */
Creep.prototype.getOccupationRallyPoint = function () {
    var occupationRallyPoint = utils.getPositionFromMemory(this.memory, 'occupationRallyPoint');

    if (_.isEmpty(occupationRallyPoint)) {
        var flag = _.first(_.filter(Game.flags, flag => {
            return flag.memory.occupy && flag.pos.roomName === this.memory.occupationTarget
        }));
        if (flag) {
            occupationRallyPoint = flag.pos;
            utils.putPositionToMemory(this.memory, 'occupationRallyPoint', occupationRallyPoint);
        }
    }

    return occupationRallyPoint;
};

/**
 * @returns {RoomPosition} The position in the current room where the army units gather
 */
Creep.prototype.getRallyPoint = function () {
    var rallyPoint = utils.getPositionFromMemory(this.memory, 'rallyPoint');

    if (_.isEmpty(rallyPoint)) {
        var flag = this.pos.findClosestByRange(FIND_FLAGS, {filter: flag => flag.memory.rallyPoint});
        if (flag) {
            rallyPoint = flag.pos;
            utils.putPositionToMemory(this.memory, 'rallyPoint', rallyPoint);
        }
    }

    return rallyPoint;
};

/**
 * Writes the given message to the log, together with the creeps name and role
 */
Creep.prototype.log = function (message) {
    console.log(`${this.name} (${this.memory.role}): ${message}`);
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
 * @returns {boolean} True, if this structure can currently receive at least one unit
 * of energy, false otherwise
 */
Structure.prototype.canReceiveEnergy = function () {
    return this.canReceiveResources(RESOURCE_ENERGY);
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
 * A utility method for getting a value from the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be get
 * @returns {*} Whatever is stored for the given key, or undefined if no value has been set
 */
Structure.prototype.getFromMemory = function (key) {
    this.initMemory();
    return this.memory[key];
};

/**
 * A utility method for setting a value to the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be set
 * @param value The value to set for the given key
 */
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

/**
 * @returns {boolean} True, if this tower has enough energy to attack, false otherwise
 */
StructureTower.prototype.canAttack = function () {
    return this.energy > TOWER_ENERGY_COST;
};

/**
 * @returns {boolean} True, if this tower has enough energy to heal, false otherwise
 */
StructureTower.prototype.canHeal = function () {
    return this.energy > TOWER_ENERGY_COST;
};