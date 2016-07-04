var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (scout) {

        if (scout.memory.previousRoom && scout.memory.previousRoom !== scout.room.name) {
            // Just moved to a new room, mark all scouting targets in the room as being scouted
            _.forEach(scout.room.find(FIND_FLAGS), flag => {
                if (flag.memory.scoutingNeeded) {
                    scout.log(`Scouted flag '${flag.name}' in room ${scout.room.name}`);
                    flag.memory.scoutingNeeded = false;
                }
            });
        }

        var scoutingTarget = this.getScoutingTarget(scout);
        if (scoutingTarget) {
            scout.moveTo(scoutingTarget);
        }

        scout.memory.previousRoom = scout.room.name;
    },

    getBody: function (energy) {
        return energy < BODYPART_COST[MOVE] ? null : [MOVE];
    },

    /**
     * @returns {*|RoomPosition} The position to scout
     */
    getScoutingTarget: function (scout) {
        var target = utils.getPositionFromMemory(scout.memory, 'scoutingTarget');
        if (target && scout.pos.roomName !== target.roomName) {
            // Not in the target room yet, so the target is still valid
            return target;
        }

        var visibleRooms = _.keys(Game.rooms);
        var flag = _.first(_.filter(Game.flags, flag => {
            return flag.memory.scoutingNeeded && !Game.getObjectById(flag.memory.scoutId) && !_.contains(visibleRooms, flag.pos.roomName)
        }));

        if (flag) {
            utils.putPositionToMemory(scout.memory, 'scoutingTarget', flag.pos);
            flag.memory.scoutId = scout.id;
            flag.memory.reserved = false;
            target = flag.pos;
        } else {
            delete scout.memory.scoutingTarget;
        }

        return target;
    }
};