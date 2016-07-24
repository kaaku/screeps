require('./constants');
require('./extensions');

var _ = require('lodash');
var utils = require('./utils');

var armyManager = require('./manager.army');
var roomController = require('./controller.room');
var spawnController = require('./controller.spawn');
var towerController = require('./controller.tower');

module.exports = {

    loop: function () {

        if (Game.time % GC_INTERVAL === 0) {
            this.performGC();
        }

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
    },

    /**
     * Performs garbage collection, i.e. clears out obsolete memory.
     */
    performGC: function () {
        _.forEach(['creeps', 'flags', 'spawns'], type => {
            if (_.has(Memory, type) && _.has(Game, type)) {
                _.forEach(Memory[type], (value, name) => {
                    if (!_.has(Game[type], name)) {
                        console.log(`GC: Deleting memory of ${type.slice(0, -1)} ${name}`);
                        delete Memory[type][name];
                    }
                });
            }
        });

        // Clear out obsolete structure memory, e.g. for towers. Here, there memory key
        // is the structure's ID, not the name, as most structures don't have names.
        _.forEach(Memory.structures, (value, id) => {
            if (Game.getObjectById(id) === null) {
                console.log(`GC: Deleting memory of structure ${id}`);
                delete Memory.structures[id];
            }
        });
    }
};