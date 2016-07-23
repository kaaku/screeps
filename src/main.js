require('./constants');
require('./extensions');

var _ = require('lodash');
var utils = require('./utils');

var armyManager = require('./manager.army');
var roomController = require('./controller.room');
var spawnController = require('./controller.spawn');
var towerController = require('./controller.tower');

module.exports.loop = function () {

    armyManager.run();

    _.forEach(utils.getMyRooms(), room => {
        if (_.isUndefined(room.memory.paths)) {
            room.memory.paths = {};
        }
        roomController.run(room)
    });

    _.forEach(Game.spawns, function (spawn) {
        spawnController.run(spawn);
    });

    _.forEach(Game.creeps, function (creep) {
        if (!creep.spawning) {
            ROLES[creep.memory.role].run(creep);
        }
    });

    _.forEach(Game.structures, function (structure) {
        if (structure.structureType === STRUCTURE_TOWER) {
            towerController.run(structure);
        }
    });
};