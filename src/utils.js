var _ = require('lodash');

module.exports = {

    /**
     * Returns the amount of friendly creeps with the given role in the given room.
     *
     * @param room The room of interest
     * @param role The name of the role the counted creeps must have,
     * or any falsy value to count all friendly creeps
     * @returns {int}
     */
    countCreeps: function (room, role) {
        return room.find(FIND_MY_CREEPS, {
            filter: creep => !role || creep.memory.role == role
        }).length;
    },

    /**
     * Returns the closest spawn, extension, storage or tower from the given
     * position that isn't already at full energy capacity.
     *
     * @param position The position to use as the source of the search
     * @returns {Structure} The closest structure, or null if no suitable
     * structure was found
     */
    findClosestEnergyDropOff: function (position) {
        return position.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: structure => {
                return ((structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.energy < structure.energyCapacity) ||
                        (structure.structureType == STRUCTURE_STORAGE &&
                        _.sum(structure.store) < structure.storeCapacity);
            }
        });
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
    }
};