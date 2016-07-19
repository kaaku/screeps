var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function () {

        // Delete the occupation flags from all rooms with visibility and no hostiles
        _.forEach(Game.flags, flag => {
            let room = Game.rooms[flag.pos.roomName];
            if (flag.memory.occupy && room && room.find(FIND_HOSTILE_CREEPS).length === 0 &&
                    utils.findDestroyableHostileStructures(room).length === 0) {
                console.log(`No hostiles left in room ${flag.pos.roomName}, stopping occupation`);
                this.stopOccupation(room.name);
            }
        });

        // Stop occupation on those rooms where the flag has been removed (manually)
        _.forEach(this.getRoomsToOccupy(), roomName => {
            let flags = _.filter(Game.flags, flag => flag.pos.roomName === roomName && flag.memory.occupy === true);
            if (_.isEmpty(flags)) {
                console.log(`No occupation flags left in room ${roomName}, stopping occupation`);
                this.stopOccupation(roomName);
            }
        });

        // Add new occupation targets based on new flags
        _.forEach(Game.flags, flag => {
            // Do the checks via the Memory object to avoid using stale data in the flag object
            // The memory of old flags has been cleaned up in previous steps
            if (Memory.flags[flag.name] && Memory.flags[flag.name].occupy && !_.contains(this.getRoomsToOccupy(), flag.pos.roomName)) {
                this.addOccupationTarget(flag);
            }
        });

        // Manage all on-going occupations
        _.forEach(this.getRoomsToOccupy(), roomName => {
            this.manageOccupations(roomName)
        });
    },

    /**
     * @param {Flag} flag The flag indicating the room to occupy
     */
    addOccupationTarget: function (flag) {
        var memory = this.getArmyMemory();
        var room = Game.rooms[flag.pos.roomName];

        if (_.isUndefined(room)) {
            if (!flag.memory.scoutingNeeded) {
                // No visibility in the room -> mark flag as a scouting target
                // The operation data can't be assembled without visibility
                console.log(`Room ${flag.pos.roomName} (marked for occupation) has no visibility, marking flag '${flag.name}' for scouting`);
                flag.memory.scoutingNeeded = true;
            }
        } else if (!_.has(memory.occupationTargets, room.name) &&
                (room.find(FIND_HOSTILE_STRUCTURES).length > 0 ||
                room.find(FIND_HOSTILE_CREEPS).length > 0)) {
            console.log(`Adding room ${room.name} to the list of occupation targets`);
            memory.occupationTargets[room.name] = this.getOperationData(room.name);
        }
    },

    manageOccupations: function (roomName) {
        var operationData = this.getOperationData(roomName);
        if (_.isEmpty(operationData)) {
            return;
        }

        if (!operationData.attackInProgress) {
            if (operationData.attackerIds.length >
                    operationData.defendingCreepCount + operationData.defendingTowerCount &&
                    operationData.attackStrength >= operationData.defenseStrength * 3) {
                // This should be enough to take the defender out, attack!
                console.log(`Starting attack on room ${roomName}!`);
                operationData.attackInProgress = true;
                _.forEach(operationData.attackerIds, creepId => {
                    var creep = Game.getObjectById(creepId);
                    if (creep) {
                        creep.memory.attackInProgress = true;
                    }
                });
            }
        } else if (operationData.attackStrength < operationData.defenseStrength / 3) {
            // We're way outpowered, stop the offensive
            console.log(`Retreating from room ${roomName}! Attack strength: ${operationData.attackStrength}, defense strength: ${operationData.defenseStrength}`);
            operationData.attackInProgress = false;
            _.forEach(operationData.attackerIds, creepId => {
                var creep = Game.getObjectById(creepId);
                if (creep) {
                    delete creep.memory.attackInProgress;
                }
            });
        }
    },

    stopOccupation: function (roomName) {
        _.forEach(Game.creeps, creep => {
            if (creep.memory.occupationTarget === roomName) {
                creep.log('Deleting occupation-related data from memory');
                delete creep.memory.occupationTarget;
                delete creep.memory.attackInProgress;
            }
        });

        // Delete all occupation flags in the room
        _.forEach(_.filter(Game.flags, flag => {
            return flag.pos.roomName === roomName && flag.memory.occupy
        }), flag => {
            console.log(`Removing occupation flag ${flag.name} from room ${roomName}`);
            delete Memory.flags[flag.name];
            flag.remove();
        });

        var operationData = this.getArmyMemory().occupationTargets[roomName];
        if (!_.isEmpty(operationData)) {
            _.forEach(operationData.attackingRoomNames, roomName => {
                if (Memory.rooms[roomName]) {
                    console.log(`Deleting occupation-related data from room ${roomName}'s memory`);
                    delete Memory.rooms[roomName].occupationInProgress
                }
            });

            console.log(`Deleting operation data related to room ${roomName}`);
            delete this.getArmyMemory().occupationTargets[roomName]
        }
    },

    /**
     * @return {Array} Returns the names of the rooms that have been marked for occupation
     */
    getRoomsToOccupy: function () {
        return _.keys(this.getArmyMemory().occupationTargets);
    },

    /**
     * @param {String} roomName The name of a room to occupy
     * @returns {Object} An object that contains data relevant to the offensive
     * (attacker and defender counts etc.)
     */
    getOperationData: function (roomName) {
        var memory = this.getArmyMemory();
        var operationData = memory.occupationTargets[roomName] || {};
        var room = Game.rooms[roomName];

        if (_.isUndefined(room) && !_.isEmpty(operationData) && Game.time - operationData.lastUpdated > 200) {
            // No visibility in room, and the data is over 200 ticks old -> send a scout
            var flag = _.first(_.filter(Game.flags, flag => {
                return Memory.flags[flag.name] && flag.memory.occupy && !flag.memory.scoutingNeeded && flag.pos.roomName === roomName
            }));
            if (flag) {
                let age = Game.time - operationData.lastUpdated;
                console.log(`Operation data for room ${roomName} is ${age} ticks old, requesting scouting for flag '${flag.name}'`);
                flag.memory.scoutingNeeded = true;
            }
        }

        if (room && (_.isEmpty(operationData) || Game.time - operationData.lastUpdated > 200)) {
            console.log(`Generating/refreshing operation data for room ${roomName}`);

            // TODO: Now all free soldiers are sent to war. Only send ones from adjacent rooms
            var soldiers = _.filter(Game.creeps, creep => {
                return _.startsWith(creep.memory.role, 'soldier') &&
                        (creep.canAttack() || creep.canHeal()) &&
                        (_.isUndefined(creep.memory.occupationTarget) ||
                        creep.memory.occupationTarget === roomName);
            });
            _.forEach(soldiers, creep => {
                creep.memory.occupationTarget = roomName
            });

            // TODO: Only rooms that currently happen to have soldiers are marked as attacking rooms
            operationData.attackingRoomNames = _.uniq(_.map(soldiers, 'room.name'));
            _.forEach(operationData.attackingRoomNames, roomName => {
                Game.rooms[roomName].memory.occupationInProgress = true
            });

            var defendingCreeps = room.find(FIND_HOSTILE_CREEPS, {
                filter: creep => creep.canAttack() || creep.canHeal()
            });
            var defendingTowers = room.find(FIND_HOSTILE_STRUCTURES, {
                filter: structure => structure.structureType === STRUCTURE_TOWER
            });

            operationData.attackerIds = _.map(soldiers, 'id');
            operationData.attackStrength = _.sum(_.map(soldiers, creep => creep.getFightingStrength()));

            operationData.defendingCreepCount = defendingCreeps.length;
            operationData.defendingTowerCount = defendingTowers.length;
            operationData.defenseStrength = _.sum(_.map(defendingCreeps, creep => creep.getFightingStrength())) +
                    defendingTowers.length * ((TOWER_POWER_ATTACK + TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)) / 2);
            operationData.hostileStructureCount = utils.findDestroyableHostileStructures(room).length;

            operationData.lastUpdated = Game.time;

            console.log(`Operation data for the occupation of room ${roomName} generated: ${JSON.stringify(operationData)}`);

            memory.occupationTargets[roomName] = operationData;
        }

        return operationData;
    },

    getArmyMemory: function () {
        if (_.isUndefined(Memory.army)) {
            Memory.army = {};
        }
        if (_.isUndefined(Memory.army.occupationTargets)) {
            Memory.army.occupationTargets = {};
        }

        return Memory.army;
    }
};