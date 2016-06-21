// TODO: Move these extensions somewhere else
Creep.prototype.canHeal = function () {
    return this.getActiveBodyparts(HEAL) > 0;
};
Creep.prototype.log = function (message) {
    console.log(`${this.name} (${this.memory.role}): ${message}`);
};

global.ROLE_HARVESTER = 'harvester';
global.ROLE_MINER = 'miner';
global.ROLE_CARRIER = 'carrier';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';

global.Roles = {
    harvester: require('harvester'),
    miner: require('miner'),
    carrier: require('carrier'),
    soldierMelee: require('soldier_melee'),
    soldierMedic: require('soldier_medic')
};

var _ = require('lodash');
var spawnController = require('./spawn');

module.exports.loop = function () {

    _.forEach(Game.spawns, function (spawnName) {
        spawnController.run(Game.spawns[spawnName]);
    });

    _.forEach(Game.creeps, function (creepName) {
        var creep = Game.creeps[creepName];
        if (!creep.spawning) {
            Roles[creep.memory.role].run(creep);
        }
    });
};