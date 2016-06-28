var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    /**
     * @param {Spawn} spawn
     */
    run: function (spawn) {
        var room = spawn.room;

        var minerCount = utils.countCreeps(room, ROLE_MINER),
                carrierCount = utils.countCreeps(room, ROLE_CARRIER);

        if (!spawn.spawning && (room.energyAvailable === room.energyCapacityAvailable ||
                ((minerCount === 0 || carrierCount === 0) && room.energyAvailable >= SPAWN_ENERGY_CAPACITY))) {

            var builderCount = utils.countCreeps(room, ROLE_BUILDER),
                    freeSource = this.findClosestFreeEnergySource(spawn);

            if (minerCount > 0 && carrierCount > 0 && room.find(FIND_HOSTILE_CREEPS).length > 0) {
                this.build(spawn, ROLE_SOLDIER_MELEE);
            } else if (carrierCount < minerCount) {
                var soloMiner = utils.findClosestSoloMiner(spawn.pos);
                if (soloMiner) {
                    this.build(spawn, ROLE_CARRIER, {minerId: soloMiner.id, sourceId: soloMiner.memory.sourceId});
                }
            } else if (freeSource) {
                this.build(spawn, ROLE_MINER, {sourceId: freeSource.id});
            } else if (builderCount < 6) {
                // TODO: Make target builder count dynamic
                this.build(spawn, ROLE_BUILDER);
            } else if (utils.countCreeps(room, ROLE_SOLDIER_MELEE) < 3) {
                this.build(spawn, ROLE_SOLDIER_MELEE);
            }
        }

        if (!spawn.spawning && room.energyAvailable > room.energyCapacityAvailable / 2 &&
                room.hasSurplusEnergy()) {
            // Check if there are some old creeps nearby that could be healed
            var adjacentOldCreeps = spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: creep => creep.ticksToLive < CREEP_LIFE_TIME / 2
            });
            var oldestCreep = _.first(_.sortBy(adjacentOldCreeps, 'ticksToLive'));
            if (oldestCreep) {
                spawn.renewCreep(oldestCreep);
            }
        }
    },

    build: function (spawn, role, memory = {}) {
        var body = Roles[role].getBody(spawn.room.energyAvailable);
        var result = spawn.createCreep(body, undefined, _.assign(memory, {role: role}));
        if (_.isString(result)) {
            console.log('Built a new ' + role + ', ' + result + ' (' + body + ')');
            return result;
        } else {
            console.log('Failed to build a new ' + role + ', error: ' + result);
            return null;
        }
    },

    findClosestFreeEnergySource: function (spawn) {
        var reservedSourceIds = _.map(spawn.room.find(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role === ROLE_MINER
        }), 'memory.sourceId');

        return spawn.pos.findClosestByRange(FIND_SOURCES_ACTIVE, {
            filter: source => _.indexOf(reservedSourceIds, source.id) < 0
        });
    }
};