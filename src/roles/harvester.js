module.exports = {

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.carry.energy < creep.carryCapacity) {
            var source = creep.pos.findClosestByPath(FIND_SOURCES);
            if (source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source);
            }
        } else {
            var target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                        structure.energy < structure.energyCapacity;
                }
            });
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target);
                }
            }
        }
    },

    getBody: function (energy) {
        var work = [], carry = [], move = [];
        while (energy >= 50) {
            if (move.length <= carry.length && move.length / 2 <= work.length) {
                move.push(MOVE);
                energy -= 50;
            } else if (carry.length < move.length && carry.length / 2 <= work.length) {
                carry.push(CARRY);
                energy -= 50;
            } else if (energy >= 100) {
                work.push(WORK);
                energy -= 100;
            }
        }

        return work.concat(carry).concat(move);
    }
};