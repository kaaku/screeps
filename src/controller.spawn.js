var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    /**
     * @param {Spawn} spawn
     */
    run: function (spawn) {

        if (_.isObject(spawn.spawning)) {
            return;
        }

        var room = spawn.room;

        // Scouts are currently used for getting visibility to rooms marked for
        // occupation, so they're prioritized (as they're so cheap)
        if (room.energyAvailable >= BODYPART_COST[MOVE]) {
            var flag = _.first(_.filter(Game.flags, flag => {
                return flag.memory.scoutingNeeded && !flag.memory.reserved && !Game.getObjectById(flag.memory.scoutId) && !_.contains(_.keys(Game.rooms), flag.pos.roomName);
            }));
            if (flag) {
                console.log(`Found flag marked for scouting with name '${flag.name}' from room ` +
                        `${flag.pos.roomName}, creating scout`);
                flag.memory.reserved = true;
                delete flag.memory.scoutId;
                this.createCreep(spawn, ROLE_SCOUT);
                return;
            }
        }

        var minerCount = utils.countCreeps(room, ROLE_MINER),
                carrierCount = utils.countCreeps(room, ROLE_CARRIER);

        if (room.energyAvailable === room.energyCapacityAvailable ||
                ((minerCount === 0 || carrierCount === 0) && room.energyAvailable >= SPAWN_ENERGY_CAPACITY)) {

            let builderCount = _.filter(Game.creeps,
                    creep => creep.memory.role === ROLE_BUILDER && creep.memory.homeRoom === room.name).length;
            let freeSource = this.findClosestFreeEnergySource(spawn);

            let claimTarget = room.getNextClaimTarget();

            if (minerCount > 0 && carrierCount > 0 &&
                    (room.find(FIND_HOSTILE_CREEPS).length > 0 || room.memory.occupationInProgress)) {
                this.createFightingCreep(spawn);
            } else if (carrierCount < minerCount) {
                var soloMiner = utils.findClosestSoloMiner(spawn.pos);
                if (soloMiner) {
                    this.createCreep(spawn, ROLE_CARRIER, {minerId: soloMiner.id, sourceId: soloMiner.memory.sourceId});
                }
            } else if (freeSource) {
                this.createCreep(spawn, ROLE_MINER, {sourceId: freeSource.id});
            } else if (_.isString(claimTarget)) {
                this.createCreep(spawn, ROLE_CLAIMER, {targetRoomName: claimTarget});
            } else if (builderCount < 3) {
                // TODO: Make target builder count dynamic
                this.createCreep(spawn, ROLE_BUILDER, {homeRoom: room.name});
            } else if (utils.countCreeps(room, [ROLE_SOLDIER_MELEE, ROLE_SOLDIER_MEDIC]) < 2) {
                // Keep a reserve of 2 soldiers and 1 medic
                this.createFightingCreep(spawn);
            }
        }

        if (room.energyAvailable > room.energyCapacityAvailable / 2 && room.hasSurplusEnergy()) {
            // Check if there are some old creeps nearby that could be healed
            var adjacentOldCreeps = spawn.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: creep => creep.ticksToLive < CREEP_LIFE_TIME * 0.8 && !creep.isObsolete()
            });
            var oldestCreep = _.first(_.sortBy(adjacentOldCreeps, 'ticksToLive'));
            if (oldestCreep) {
                spawn.renewCreep(oldestCreep);
            }
        }
    },

    createFightingCreep: function (spawn) {
        var soldierCount = utils.countCreeps(spawn.room, ROLE_SOLDIER_MELEE);
        var medicCount = utils.countCreeps(spawn.room, ROLE_SOLDIER_MEDIC);
        // There should be 1 medic per 4 soldiers, with the first medic being built after 2 soldiers
        var role = soldierCount < 2 || soldierCount < medicCount * 4 + 2 ?
                ROLE_SOLDIER_MELEE : ROLE_SOLDIER_MEDIC;

        return this.createCreep(spawn, role);
    },

    createCreep: function (spawn, role, memory = {}) {
        var body = ROLES[role].getBody(spawn.room.energyAvailable);
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