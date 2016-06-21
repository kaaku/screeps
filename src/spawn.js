var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    /**
     * @param {Spawn} spawn
     */
    run: function (spawn) {
        var room = spawn.room;

        if (room.energyAvailable === room.energyCapacityAvailable) {

            // TODO: Way too many soldiers! Create builders instead.
            var minerCount = utils.countCreeps(room, ROLE_MINER),
                    carrierCount = utils.countCreeps(room, ROLE_CARRIER),
                soldierMeleeCount = utils.countCreeps(room, ROLE_SOLDIER_MELEE),
                    medicCount = utils.countCreeps(room, ROLE_SOLDIER_MEDIC),
                    freeSource = this.findClosestFreeEnergySource(spawn);

            if (carrierCount < minerCount) {
                var soloMiner = spawn.pos.findClosestByPath(FIND_MY_CREEPS, {
                    filter: creep => creep.memory.role === ROLE_MINER && !Game.getObjectById(creep.memory.carrierId)
                });
                if (soloMiner) {
                    this.build(spawn, ROLE_CARRIER, {minerId: soloMiner.id, sourceId: soloMiner.memory.sourceId});
                }
            } else if (freeSource) {
                this.build(spawn, ROLE_MINER, {sourceId: freeSource.id});
            } else if (soldierMeleeCount > 0 && medicCount === 0) {
                this.build(spawn, ROLE_SOLDIER_MEDIC);
            } else {
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