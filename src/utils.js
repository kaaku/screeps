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
     * Returns the closest structure from the given position that isn't already at
     * full energy capacity.
     *
     * @param {RoomPosition} position The position to use as the source of the search
     * @param {String|Array} ignoreStructureTypes One or more structure types to
     * ignore in the search
     * @returns {Structure} The closest structure that can receive energy, or null
     * if no structures in the room can currently receive energy
     */
    findClosestEnergyDropOff: function (position, ignoreStructureTypes = []) {
        if (_.isString(ignoreStructureTypes)) {
            ignoreStructureTypes = [ignoreStructureTypes];
        }
        return position.findClosestByRange(FIND_STRUCTURES, {
            filter: structure => !_.contains(ignoreStructureTypes, structure.structureType) &&
            structure.canReceiveEnergy()
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