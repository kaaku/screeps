module.exports = {

    run: function (creep) {
        var friendlies = creep.room.find(FIND_MY_CREEPS);
        var weakest, lowestHealth = 1;

        // TODO: Follow the previous heal target

        _.forEach(friendlies, function (creep) {
            var healthLeft = creep.hits / creep.hitsMax;
            if (healthLeft < lowestHealth) {
                lowestHealth = healthLeft;
                weakest = creep;
            }
        });

        // TODO: Make sure the medic can also heal itself

        if (weakest) {
            if (creep.heal(weakest) == ERR_NOT_IN_RANGE) {
                creep.moveTo(weakest);
            }
        } else {
            var spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                creep.moveTo(spawn);
            }
        }
    },

    getBody: function (energy) {
        var tough = [], attack = [], heal = [], move = [];
        while (energy >= 10) {
            if (energy < 50) {
                tough.push(TOUGH);
                energy -= 10;
            } else if (energy >= 50 && move.length < heal.length) {
                move.push(MOVE);
                energy -= 50;
            } else if (energy >= 80 && attack.length < heal.length - 1) {
                attack.push(ATTACK);
                energy -= 80;
            } else if (energy >= 250) {
                heal.push(HEAL);
                energy -= 250;
            }
        }

        return tough.concat(attack).concat(move).concat(heal);
    }
};