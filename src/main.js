// TODO: Move these extensions somewhere else
Creep.prototype.canHeal = function () {
    return this.getActiveBodyparts(HEAL) > 0;
};
Creep.prototype.log = function (message) {
    console.log(`${this.name} (${this.memory.role}): ${message}`);
};

global.ROLE_HARVESTER = 'harvester';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';

global.Roles = {
    harvester: require('harvester'),
    soldierMelee: require('soldier_melee'),
    soldierMedic: require('soldier_medic')
};

var spawn = require('spawn');

module.exports.loop = function () {

    for (var spawnName in Game.spawns) {
        spawn.run(Game.spawns[spawnName]);
    }

    for (var creepName in Game.creeps) {
        var creep = Game.creeps[creepName];
        if (!creep.spawning) {
            Roles[creep.memory.role].run(creep);
        }
    }
};