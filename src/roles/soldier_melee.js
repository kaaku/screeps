module.exports = {

    /**
     * @param {Creep} creep
     */
    run: function (creep) {
        if (creep.getActiveBodyparts(ATTACK) === 0) {
            creep.log('Weapons broken!');
            var closestMedic = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
                filter: (creep) => creep.canHeal()
            });
            if (closestMedic) {
                creep.log('Running to closest medic');
                creep.moveTo(closestMedic);
            } else {
                creep.log('Running to closest spawn');
                creep.moveTo(creep.pos.findClosestByPath(FIND_MY_SPAWNS));
            }
        } else {
            var hostile = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
            if (hostile && creep.pos.getRangeTo(hostile) < 10) {
                if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(hostile);
                }
            } else {
                var spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
                if (spawn && creep.pos.getRangeTo(spawn) > 5) {
                    creep.moveTo(spawn);
                }
            }
        }
    },

    getBody: function (energy) {
        var attack = [], move = [], tough = [];
        while (energy >= 10) {
            if (energy < 50) {
                tough.push(TOUGH);
                energy -= 10;
            } else if (energy >= 100 && attack.length <= move.length) {
                attack.push(ATTACK);
                tough.concat([TOUGH, TOUGH]);
                energy -= 100;
            } else if (energy >= 50 && move.length < attack.length) {
                move.push(MOVE);
                energy -= 50;
            }
        }

        return tough.concat(attack).concat(move);
    }
};