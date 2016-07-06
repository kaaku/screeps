var _ = require('lodash');

module.exports = {

    /**
     * Returns the amount of friendly creeps with the given roles in the given room.
     *
     * @param {Room} room The room of interest
     * @param {String|Array} roles The names of the roles the counted creeps must have,
     * or any falsy value to count all friendly creeps
     * @returns {int}
     */
    countCreeps: function (room, roles = []) {
        if (_.isString(roles)) {
            roles = [roles];
        }
        return room.find(FIND_MY_CREEPS, {
            filter: creep => _.isEmpty(roles) || _.contains(roles, creep.memory.role)
        }).length;
    },

    /**
     * Returns the closest structure from the given position that isn't already at
     * full energy capacity.
     *
     * @param {RoomPosition} position The position to use as the source of the search
     * @param {String|Array} ignoreStructures One or more structure IDs to ignore in
     * the search
     * @returns {Structure} The closest structure that can receive energy, or null
     * if no structures in the room can currently receive energy
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
     * @returns {Array<Room>} Returns an array of rooms that have a friendly controller in them
     */
    getMyRooms: function () {
        return _.filter(Game.rooms, room => !_.isUndefined(room.controller) && room.controller.my);
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