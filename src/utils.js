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
    }
};