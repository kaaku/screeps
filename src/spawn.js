var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    /**
     * @param {Spawn} spawn
     */
    run: function (spawn) {
        var room = spawn.room;

        if (room.energyAvailable === room.energyCapacityAvailable ||
                (utils.countCreeps(room, ROLE_MINER) === 0 && spawn.energy === spawn.energyCapacity)) {

            var minerCount = utils.countCreeps(room, ROLE_MINER),
                    carrierCount = utils.countCreeps(room, ROLE_CARRIER),
                    builderCount = utils.countCreeps(room, ROLE_BUILDER),
                    freeSource = this.findClosestFreeEnergySource(spawn);

            if (room.find(FIND_HOSTILE_CREEPS).length > 0) {
                this.build(spawn, ROLE_SOLDIER_MELEE);
            } else if (carrierCount < minerCount) {
                var soloMiner = utils.findClosestSoloMiner(spawn.pos);
                if (soloMiner) {
                    this.build(spawn, ROLE_CARRIER, {minerId: soloMiner.id, sourceId: soloMiner.memory.sourceId});
                }
            } else if (freeSource) {
                this.build(spawn, ROLE_MINER, {sourceId: freeSource.id});
            } else if (builderCount < 3) {
                this.build(spawn, ROLE_BUILDER);
            } else if (utils.countCreeps(room, ROLE_SOLDIER_MELEE) < 3) {
                this.build(spawn, ROLE_SOLDIER_MELEE);
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

        return spawn.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
            filter: source => _.indexOf(reservedSourceIds, source.id) < 0
        });
    }
};