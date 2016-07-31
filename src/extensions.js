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
 * @returns {boolean} True, if this creep can attack a controller's downgrade or
 * reservation timer.
 */
Creep.prototype.canAttackController = function () {
    return this.getActiveBodyparts(CLAIM) * CONTROLLER_CLAIM_DOWNGRADE >= 1;
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
 * Finds the closest structure that can receive energy, and either transfers the
 * maximum amount of energy to that structure if it's nearby, or moves towards
 * the structure otherwise.
 */
Creep.prototype.deliverEnergy = function () {
    var dropOff = this.getEnergyDropOff();

    if (dropOff) {
        if (!this.pos.isNearTo(dropOff)) {
            this.moveTo(dropOff);
        } else {
            this.transfer(dropOff, RESOURCE_ENERGY);

            if (this.fatigue === 0 && this.carry[RESOURCE_ENERGY] > dropOff.getResourceDeficiency(RESOURCE_ENERGY)) {
                // The drop off can't receive all the energy this creep carries,
                // so move towards the next drop off
                dropOff = this.getEnergyDropOff(true);
                if (dropOff) {
                    this.moveTo(dropOff);
                }
            }
        }
    }
};

/**
 * Returns a structure this creep should deliver its energy to.
 *
 * @param {Boolean} forceNew If true, the current drop off structure stored in memory
 * (if any) is ignored, and a new one is acquired.
 *
 * @returns {null|Structure} A structure to deliver energy to, or null if no valid
 * energy drop offs are available
 */
Creep.prototype.getEnergyDropOff = function (forceNew = false) {
    var dropOff;
    if (!forceNew) {
        dropOff = Game.getObjectById(this.memory.dropOffId);
    }

    if (!dropOff || !dropOff.canReceiveEnergy()) {
        let ignored = [];
        if (_.isArray(this.room.memory.dropOffContainerIds)) {
            Array.prototype.push.apply(ignored, this.room.memory.dropOffContainerIds);
        }
        if (forceNew && _.isString(this.memory.dropOffId)) {
            ignored.push(this.memory.dropOffId);
        }
        dropOff = utils.findClosestEnergyDropOff(this.pos, ignored);
        this.memory.dropOffId = dropOff ? dropOff.id : null;
    }

    return dropOff;
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
 * Determines if this creep is obsolete or not. If a creep with the same role would be
 * built now and have a bigger body than this creep, then this creep is considered
 * to be obsolete.
 *
 * Note that this check is bound to the room the creep is currently in. This shouldn't
 * be a problem, though, as most creeps don't travel to other rooms, and those that do
 * don't hang out at spawns waiting to be renewed.
 *
 * @returns {boolean} True, if this creep is obsolete, false otherwise.
 */
Creep.prototype.isObsolete = function () {
    var originalBuildCost = _.reduce(this.body, (sum, part) => sum + BODYPART_COST[part.type], 0);
    var newCreepBuildCost = _.reduce(ROLES[this.memory.role].getBody(this.room.energyCapacityAvailable),
            (sum, part) => sum + BODYPART_COST[part], 0);

    return originalBuildCost < newCreepBuildCost;
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
 * Transfers resources of the given type to an adjacent creep. If there are multiple
 * adjacent creeps, transfers to the one with the biggest (percentual) resource deficiency.
 * If this creep has no resources of the given type, or if no applicable creeps are nearby,
 * does nothing.
 *
 * @param {String} resourceType The type of resource to transfer
 * @param {String|Array} roles Only transfer resources to creeps with the given role.
 * If no value is given, transfers to any adjacent creep
 */
Creep.prototype.transferResourcesToAdjacentCreep = function (resourceType = RESOURCE_ENERGY, roles = []) {
    if (this.carry[resourceType] > 0) {
        if (_.isString(roles)) {
            roles = [roles];
        }

        var adjacentNonFullCreeps = this.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: creep => {
                return (_.isEmpty(roles) || _.includes(roles, creep.memory.role)) &&
                        _.sum(creep.carry) < creep.carryCapacity
            }
        });
        var creepWithBiggestDeficiency = _.first(_.sortBy(adjacentNonFullCreeps,
                creep => _.sum(creep.carry) / creep.carryCapacity));

        this.transfer(creepWithBiggestDeficiency, resourceType);
    }
};

/**
 * @returns {boolean} True, if this is an energy pile, false otherwise
 */
Resource.prototype.hasEnergy = function () {
    return this.resourceType === RESOURCE_ENERGY && this.amount > 0;
};

/**
 * Registers the given room as a claim target for this room, meaning that a spawn in this
 * room should build a claimer creep and send it to claim the given room.
 *
 * @param {String} roomName The name of the room to claim
 */
Room.prototype.addClaimTarget = function (roomName) {
    var claimTargets = this.memory.claimTargets || [];
    let room = Game.rooms[roomName];
    if (!_.contains(claimTargets, roomName) && (_.isUndefined(room) || !room.isFriendly())) {
        this.log(`Registered new claim target: ${roomName}`);
        claimTargets.push(roomName);
    }
    this.memory.claimTargets = claimTargets;
};

/**
 * Returns the name of the room that should be claimed next. A room can have multiple
 * claim targets, which are processed one by one. In these cases, this method returns
 * the first room with no claimers assigned to it at the moment.
 *
 * @returns {null|String} The name of the next room to claim, or null if there are
 * no rooms in the queue.
 */
Room.prototype.getNextClaimTarget = function () {
    if (!_.isEmpty(this.memory.claimTargets)) {
        // Remove obsolete claim targets from memory
        let allClaimTargets = _.map(utils.getClaimFlags(), 'pos.roomName');
        let myRooms = _.map(utils.getMyRooms(), 'name');
        let obsoleteTargets = _.remove(this.memory.claimTargets,
                target => !_.contains(allClaimTargets, target) || _.contains(myRooms, target));
        if (!_.isEmpty(obsoleteTargets)) {
            this.log(`Removed obsolete claim target(s): ${obsoleteTargets}`);
        }
    }

    if (!_.isEmpty(this.memory.claimTargets)) {
        for (let target of this.memory.claimTargets) {
            if (utils.countCreeps(null, ROLE_CLAIMER, c => c.memory.targetRoomName === target) === 0) {
                return target;
            }
        }
    }

    return null;
};

/**
 * Finds the claim flag from this room and returns it, or null if no claim
 * flag exists in the room.
 *
 * @returns {null|Flag} The claim flag in the room, or null
 */
Room.prototype.findClaimFlag = function () {
    var flag = _.first(this.find(FIND_FLAGS, {
        filter: flag => _.startsWith(flag.name.toLowerCase(), 'claim')
    }));
    return flag ? flag : null;
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
 * @returns {boolean} True, if this room is friendly, i.e. has a controller that is
 * owned by me.
 */
Room.prototype.isFriendly = function () {
    return _.has(this, 'controller') && this.controller.my === true;
};

/**
 * @returns {boolean} True, if this room is friendly or neutral. Reserved rooms are
 * considered to be neutral.
 */
Room.prototype.isFriendlyOrNeutral = function () {
    return _.isEmpty(this.controller) || this.controller.my;
};

/**
 * Writes the given message to the console, prepended with the room name.
 *
 * @param {String} message The message to log
 */
Room.prototype.log = function (message = '') {
    console.log(`${this.name}: ${message}`);
};

/**
 * @returns {boolean} True, if this object can currently attack, false otherwise.
 */
RoomObject.prototype.canAttack = function () {
    return false;
};

/**
 * @returns {boolean} True, if this object can currently heal, false otherwise
 */
RoomObject.prototype.canHeal = function () {
    return false;
};

/**
 * Determines if this position has a structure of the given type.
 *
 * @param {String} structureType One of the STRUCTURE_* constants
 * @param {Boolean} includeConstructionSites Whether to check for construction sites as well
 * @returns {boolean}
 */
RoomPosition.prototype.hasStructure = function (structureType, includeConstructionSites = true) {
    return !_.isEmpty(_.filter(this.lookFor(LOOK_STRUCTURES), s => s.structureType === structureType)) ||
            includeConstructionSites && !_.isEmpty(_.filter(this.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType === structureType));
};

/**
 * @return {Boolean} True, if structures can be built on this square, false otherwise.
 * Note that some structures can be built on roads; this method does not handle those cases.
 */
RoomPosition.prototype.canBeBuiltOn = function () {
    return _.isEmpty(this.lookFor(LOOK_STRUCTURES)) &&
            _.isEmpty(this.lookFor(LOOK_CONSTRUCTION_SITES)) &&
            this.lookFor(LOOK_TERRAIN)[0] !== 'wall';
};

/**
 * Counts the amount of structures of the given type in the specified range around this position.
 * Only counts neutral and friendly structures, not hostiles.
 *
 * @param {String} structureType One of the STRUCTURE_* constants
 * @param {int} range The range to look in
 * @param {boolean} includeConstructionSites Whether to also count construction sites
 * of the given type or not
 * @returns {int} The amount of structures (and possibly construction sites) found,
 * or -1 if the arguments were invalid
 */
RoomPosition.prototype.countStructuresInRange = function (structureType, range = 1,
                                                          includeConstructionSites = false) {
    if (!(_.isString(structureType) && _.isNumber(range) && _.isBoolean(includeConstructionSites) &&
            _.has(CONTROLLER_STRUCTURES, structureType) && range > 0)) {
        return -1;
    }

    var isNeutralStructureType = utils.isNeutralStructureType(structureType);
    var findType = isNeutralStructureType ? FIND_STRUCTURES : FIND_MY_STRUCTURES;
    var amount = this.findInRange(findType, range, {filter: s => s.structureType === structureType}).length;

    if (includeConstructionSites) {
        findType = isNeutralStructureType ? FIND_CONSTRUCTION_SITES : FIND_MY_CONSTRUCTION_SITES;
        amount += this.findInRange(findType, range, {filter: s => s.structureType === structureType}).length;
    }

    return amount;
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
    return (this.hasResourceStore() && _.sum(this.store) < this.storeCapacity) ||
            (resourceType === RESOURCE_ENERGY && this.hasEnergyStore() && this.energy < this.energyCapacity);
};

/**
 * Returns the amount of resources of the given type that can be transferred into this
 * structure. If the structure is full, or can't store resources of the given type,
 * returns 0.
 *
 * @param {String} resourceType The type of resources to check against
 * @returns {number}
 */
Structure.prototype.getResourceDeficiency = function (resourceType = RESOURCE_ENERGY) {
    if (this.hasResourceStore()) {
        return this.storeCapacity - _.sum(this.store);
    }

    if (resourceType === RESOURCE_ENERGY && this.hasEnergyStore()) {
        return this.energyCapacity - this.energy;
    }

    return 0;
};

/**
 * @return {int} The amount of hit points this structure should be repaired to.
 */
Structure.prototype.getTargetHits = function () {
    var room = this.room;
    if (_.isUndefined(room) || _.isUndefined(room.controller) || !room.controller.my || !_.has(STRUCTURE_TARGET_HITS, this.structureType) || !_.has(STRUCTURE_TARGET_HITS[this.structureType], room.controller.level + '')) {
        return this.hitsMax;
    }

    return STRUCTURE_TARGET_HITS[this.structureType][room.controller.level];
};

/**
 * @return {boolean} True, if this structure has energy, false otherwise
 */
Structure.prototype.hasEnergy = function () {
    return this.hasResources(RESOURCE_ENERGY);
};

/**
 * @returns {boolean} True, if this structure can store energy, but NOT
 * other resource types
 */
Structure.prototype.hasEnergyStore = function () {
    return _.isNumber(this.energy) && _.isNumber(this.energyCapacity);
};

/**
 * @param {String} resourceType One of the RESOURCE_* constants
 * @returns {boolean} True, if this structure has resources of the given type,
 * false otherwise
 */
Structure.prototype.hasResources = function (resourceType = RESOURCE_ENERGY) {
    return (_.isObject(this.store) && this.store[resourceType] > 0) ||
            (resourceType === RESOURCE_ENERGY && _.isNumber(this.energy) && this.energy > 0);
};

/**
 * @returns {boolean} True, if this structure can store any resource type
 */
Structure.prototype.hasResourceStore = function () {
    return _.isObject(this.store) && _.isNumber(this.storeCapacity);
};

/**
 * @returns {boolean} True, if this structure is friendly or neutral, false otherwise
 */
Structure.prototype.isFriendlyOrNeutral = function () {
    return _.isUndefined(this.my) || this.my === true;
};

/**
 * Writes the given message to the console, prepended with the structure name/type.
 *
 * @param {String} message The message to log
 */
Structure.prototype.log = function (message = '') {
    var source = _.isString(this.name) ? this.name : this.structureType;
    console.log(`${source} (${this.pos.roomName}): ${message}`);
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
 * A utility method for deleting a value from the structure's memory object. Useful with
 * structures that don't have a memory reference of their own, e.g. towers.
 *
 * @param {String} key The key whose corresponding value should be deleted
 */
Structure.prototype.clearFromMemory = function (key) {
    if (_.isObject(this.memory) && _.has(this.memory, key)) {
        delete this.memory[key];
    }
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