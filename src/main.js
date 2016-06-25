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
global.ROLE_BUILDER = 'builder';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';

global.Roles = {
    harvester: require('./role.harvester'),
    miner: require('./role.miner'),
    carrier: require('./role.carrier'),
    builder: require('./role.builder'),
    soldierMelee: require('./role.soldier_melee'),
    soldierMedic: require('./role.soldier_medic')
};

var _ = require('lodash');
var spawnController = require('./spawn');

module.exports.loop = function () {

    _.forEach(Game.spawns, function (spawn) {
        spawnController.run(spawn);
    });

    _.forEach(Game.creeps, function (creep) {
        if (!creep.spawning) {
            Roles[creep.memory.role].run(creep);
        }
    });
};