var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (claimer) {
        var roomName = this.getTargetRoomName(claimer);
        if (!roomName) {
            // No claim flags anywhere, just idle
            return;
        }

        if (claimer.room.name !== roomName) {
            let claimFlags = _.filter(utils.getClaimFlags(), flag => flag.pos.roomName === roomName);
            if (!_.isEmpty(claimFlags)) {
                claimer.moveTo(claimFlags[0]);
            } else {
                // Claim flag not found for some reason, move to an arbitrary point
                // in the room until the creep reaches the room
                claimer.moveTo(new RoomPosition(25, 25, roomName));
            }
        } else {
            let controller = claimer.room.controller;
            if (!controller) {
                // Invalid flag, do nothing
                return;
            }

            if (claimer.pos.isNearTo(controller)) {
                if (controller.level === 0) {
                    // Neutral controller
                    let reservedBy = _.isObject(controller.reservation) ? controller.reservation.username : null;

                    if (reservedBy === null || reservedBy === claimer.owner.username) {
                        if (utils.getMyRooms().length < Game.gcl.level) {
                            claimer.log(`Claiming controller in room ${roomName}`);
                            claimer.claimController(controller);
                        } else {
                            // Reserved by me, keep on adding to the timer
                            claimer.reserveController(controller);
                        }
                    } else if (reservedBy !== null && reservedBy !== claimer.owner.username &&
                            claimer.canAttackController()) {
                        // Reserved by someone else, attack the timer
                        claimer.attackController(controller);
                    }
                } else if (!controller.my && claimer.canAttackController()) {
                    // The controller is owned by someone else
                    claimer.attackController(controller);
                }
            } else {
                claimer.moveTo(controller);
            }
        }
    },

    getTargetRoomName: function (claimer) {
        var roomName = claimer.memory.targetRoomName;
        if (roomName && (!Game.rooms[roomName] || Game.rooms[roomName].findClaimFlag() !== null)) {
            return roomName;
        }

        var claimFlags = utils.getClaimFlags();
        if (_.isEmpty(claimFlags)) {
            delete claimer.memory.targetRoomName;
            return null;
        }

        var claimFlag = claimer.room.findClaimFlag();
        if (claimFlag !== null) {
            claimer.memory.targetRoomName = claimFlag.pos.roomName;
            claimer.log(`Registering room ${claimFlag.pos.roomName} as claim target`);
            return claimFlag.pos.roomName;
        }

        var adjacentRoomNames = _.values(Game.map.describeExits(claimer.room.name));
        var closeByFlags = _.filter(claimFlags, flag => _.contains(adjacentRoomNames, flag.pos.roomName));
        if (!_.isEmpty(closeByFlags)) {
            claimFlag = _.first(closeByFlags);
            claimer.memory.targetRoomName = claimFlag.pos.roomName;
            claimer.log(`Registering room ${claimFlag.pos.roomName} as claim target`);
            return claimFlag.pos.roomName;
        }

        claimFlag = null;
        var shortestDistance;
        _.forEach(claimFlags, flag => {
            let distance = claimFlag !== null ?
                    Game.map.getRoomLinearDistance(claimFlag.pos.roomName, flag.pos.roomName) : null;
            if (claimFlag === null || _.isNumber(distance) && _.isNumber(shortestDistance) &&
                    distance < shortestDistance) {
                claimFlag = flag;
                shortestDistance = distance;
            }
        });

        claimer.memory.targetRoomName = claimFlag.pos.roomName;
        claimer.log(`Registering room ${claimFlag.pos.roomName} as claim target`);
        return claimFlag.pos.roomName;
    },

    getBody: function (energy) {
        var pairCost = BODYPART_COST[MOVE] + BODYPART_COST[CLAIM];

        if (energy < pairCost) {
            return null;
        }

        var move = [], claim = [];
        while (energy >= pairCost) {
            move.push(MOVE);
            claim.push(CLAIM);
            energy -= pairCost;
        }

        return claim.concat(move);
    }
};