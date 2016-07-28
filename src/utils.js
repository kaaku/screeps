var _ = require('lodash');

module.exports = {

    /**
     * Determines whether a structure of the given type can be built in the given room
     * based on the structure type limitations tied to the room's controller level.
     *
     * @param {String} structureType One of the STRUCTURE_* constants
     * @param {Room} room The room where the check should be made
     * @returns {boolean} True, if structures of the given type can still legally
     * be built in the given room, false otherwise
     */
    canBuildStructure: function (structureType, room) {
        var roomLevel = (room.controller ? room.controller.level : 0) + '';
        var currentAmount = this.countStructures(room, structureType, true);
        return _.has(CONTROLLER_STRUCTURES, structureType) &&
                _.has(CONTROLLER_STRUCTURES[structureType], roomLevel) &&
                currentAmount < CONTROLLER_STRUCTURES[structureType][roomLevel];
    },

    /**
     * Counts the amount of friendly creeps. The creeps that are included can
     * be narrowed down with the parameters.
     *
     * @param {Room} room If provided, only creeps in the given room are counted
     * @param {String|Array} roles The names of the roles the counted creeps must have,
     * or any falsy value to count all friendly creeps
     * @param {Function} predicate An additional filter that will be applied to the
     * search results. The function will receive a single creep as a parameter. The
     * creeps the predicate returns truthy for will be kept.
     * @returns {int}
     */
    countCreeps: function (room = null, roles = [], predicate = null) {
        if (_.isString(roles)) {
            roles = [roles];
        }

        let filter = function (creep) {
            return (_.isEmpty(roles) || _.contains(roles, creep.memory.role)) &&
                    (!_.isFunction(predicate) || predicate(creep));
        };

        if (room instanceof Room) {
            return room.find(FIND_MY_CREEPS, {filter: filter}).length;
        } else {
            return _.filter(Game.creeps, filter).length;
        }
    },

    /**
     * Counts the amount of structures (and possibly construction sites) of the given type
     * in the given room.
     *
     * @param {Room} room The room whose structures to count
     * @param {String} structureType One of the STRUCTURE_* constants
     * @param {Boolean} includeConstructionSites Whether to include construction sites or not
     * @returns {int}
     */
    countStructures: function (room, structureType, includeConstructionSites = false) {
        var count = room.find(FIND_STRUCTURES, {filter: s => s.structureType === structureType}).length;
        if (includeConstructionSites) {
            count += room.find(FIND_CONSTRUCTION_SITES, {filter: s => s.structureType === structureType}).length;
        }
        return count;
    },

    /**
     * Returns the closest structure from the given position that isn't already at
     * full energy capacity. Prioritizes towers, then spawns and extensions, then
     * other structures that can store energy.
     *
     * @param {RoomPosition} position The position to use as the source of the search
     * @param {String|Array} ignoreStructures One or more structure IDs to ignore in
     * the search
     * @returns {Structure} The closest structure that can receive energy. If the room
     * where the given position is located has no visibility, or if no structures
     * in the room can currently receive energy, this method returns null
     */
    findClosestEnergyDropOff: function (position, ignoreStructures = []) {
        if (_.isString(ignoreStructures)) {
            ignoreStructures = [ignoreStructures];
        }

        var room = Game.rooms[position.roomName];
        if (!room) {
            return null;
        }

        var structures = room.find(FIND_STRUCTURES, {
            filter: structure => {
                return structure.isFriendlyOrNeutral() && !_.contains(ignoreStructures, structure.id) &&
                        structure.canReceiveEnergy()
            }
        });

        var towers = _.filter(structures, s => s.structureType === STRUCTURE_TOWER);
        if (!_.isEmpty(towers)) {
            return position.findClosestByRange(towers);
        }

        var spawnsAndExtensions = _.filter(structures, s => {
            return s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION;
        });
        if (!_.isEmpty(spawnsAndExtensions)) {
            return position.findClosestByRange(spawnsAndExtensions);
        }

        return position.findClosestByRange(structures);
    },

    /**
     * Finds the miner closest to the given position that doesn't have a carrier
     * linked to it. If there are no miners in the room, or all have a carrier linked
     * to them, returns null.
     *
     * @param {RoomPosition} pos
     */
    findClosestSoloMiner: function (pos) {
        return pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role === ROLE_MINER && !Game.getObjectById(creep.memory.carrierId)
        });
    },

    /**
     * Finds all hostile structures in the given room that can be destroyed (i.e. everything
     * except for the controller)
     *
     * @param {Room} room The room to perform the search in
     */
    findDestroyableHostileStructures: function (room) {
        if (_.isEmpty(room)) {
            return [];
        }

        return room.find(FIND_HOSTILE_STRUCTURES, {
            filter: structure => structure.structureType !== STRUCTURE_CONTROLLER
        });
    },

    /**
     * Returns the names of the rooms that are "linked" (i.e. have exits) to the
     * given room. The depth parameter can be used to define how far to travel
     * from the given room. E.g. if depth is 3, this method will return all
     * rooms that can be traveled to from the source room by going through
     * a maximum of 2 other rooms.
     *
     * Example return value:
     *
     * {
     *      'E1N1': {distance: 1},
     *      'E1N2': {distance: 2}
     * }
     *
     * @param {String} roomName The name of the source room
     * @param {int} depth How far to travel from the source room
     * @returns {Object} An object with the room names as keys, and objects
     * with the distance information as values
     */
    getLinkedRooms: function (roomName, depth = 1) {
        if (!_.isString(roomName) || !_.isNumber(depth)) {
            return [];
        }

        var linkedRooms = {};
        var roomsFromPreviousStep = [roomName];

        for (let i = 1; i <= depth; i++) {
            let newLinkedRooms = [];
            for (let room of roomsFromPreviousStep) {
                let exits = Game.map.describeExits(room);
                if (!_.isEmpty(exits)) {
                    newLinkedRooms = newLinkedRooms.concat(_.values(exits));
                }
            }
            _.forEach(newLinkedRooms, linkedRoom => {
                if (linkedRoom !== roomName && !_.has(linkedRooms, linkedRoom)) {
                    linkedRooms[linkedRoom] = {distance: i};
                }
            });
            roomsFromPreviousStep = newLinkedRooms;
        }

        return linkedRooms;
    },

    /**
     * @returns {Array<Flag>}  All game flags located anywhere in the game world
     */
    getClaimFlags: function () {
        return _.filter(Game.flags, flag => _.startsWith(flag.name.toLowerCase(), 'claim'));
    },

    /**
     * @returns {Array<Room>} Returns an array of rooms that have a friendly controller in them
     */
    getMyRooms: function () {
        return _.filter(Game.rooms, room => room.isFriendly());
    },

    /**
     * De-serializes a room position object from memory into a RoomPosition object
     *
     * @param {Object} memoryObject The memory object containing the serialized position
     * @param {String} key The key of the position object in the memory
     * @returns {RoomPosition}
     */
    getPositionFromMemory: function (memoryObject, key) {
        if (_.isObject(memoryObject) && _.isString(key) && _.has(memoryObject, key)) {
            return new RoomPosition(memoryObject[key].x, memoryObject[key].y, memoryObject[key].roomName);
        }

        return null;
    },

    /**
     * Serializes a RoomPosition object into memory
     *
     * @param {Object}memoryObject The memory object to where the position is stored
     * @param {String} key The key under which the position will be stored
     * @param {RoomPosition} pos The position object to serialize
     */
    putPositionToMemory: function (memoryObject, key, pos) {
        if (_.isObject(memoryObject) && _.isString(key) && _.isObject(pos)) {
            memoryObject[key] = {
                x: pos.x,
                y: pos.y,
                roomName: pos.roomName
            }
        }
    }
};