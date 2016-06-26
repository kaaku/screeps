var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (carrier) {

        carrier.pickupEnergyInRange();

        if (_.sum(carrier.carry) === carrier.carryCapacity || carrier.ticksToLive < 50) {
            carrier.memory.inDeliveryMode = true;
        } else if (_.sum(carrier.carry) === 0) {
            carrier.memory.inDeliveryMode = false;
        }

        this.transferEnergyToAdjacentBuilders(carrier);

        if (carrier.memory.inDeliveryMode) {
            var dropOff = utils.findClosestEnergyDropOff(carrier.pos);
            if (dropOff) {
                if (!carrier.pos.isNearTo(dropOff)) {
                    carrier.moveTo(dropOff);
                }

                if (carrier.pos.isNearTo(dropOff)) {
                    carrier.transfer(dropOff, RESOURCE_ENERGY);
                }
            }
        } else {
            var miner = this.getMiner(carrier);
            if (miner) {
                if (!carrier.pos.isNearTo(miner)) {
                    // It's enough to get close to the miner. The miner will realize this
                    // and transfer its energy on its own. If the miner has dropped energy
                    // on the ground, that will get picked up by pickupEnergyInRange()
                    carrier.moveTo(miner);
                } else {
                    // Pick up energy from the container under the miner
                    var container = _.head(_.filter(miner.pos.lookFor(LOOK_STRUCTURES),
                            {'structureType': STRUCTURE_CONTAINER}));
                    if (container && container.store[RESOURCE_ENERGY] > 0) {
                        container.transfer(carrier, RESOURCE_ENERGY);
                    }
                }
            } else {
                // No miners in the room, check for energy piles
                var energy = carrier.pos.findClosestByPath(FIND_DROPPED_ENERGY);
                if (energy && !carrier.pos.isNearTo(energy) && !carrier.fatigue) {
                    carrier.moveTo(energy);
                }
            }
        }

        // In case we moved. Energy pickups are free!
        carrier.pickupEnergyInRange();
    },

    getBody: function (energy) {
        if (energy < BODYPART_COST[CARRY] + BODYPART_COST[MOVE]) {
            return null;
        }

        var carry = [], move = [];
        var cheapestPart = _.min([BODYPART_COST[CARRY], BODYPART_COST[MOVE]]);

        while (energy >= cheapestPart) {
            if (energy >= BODYPART_COST[MOVE] &&
                    (!move.length || move.length * 2 < carry.length || energy < BODYPART_COST[CARRY])) {
                energy = this.addPart(energy, move, MOVE);
            } else if (energy >= BODYPART_COST[CARRY]) {
                energy = this.addPart(energy, carry, CARRY);
            } else {
                // Should never end up here, but just to make sure we avoid an infinite loop
                break;
            }
        }

        return carry.concat(move);
    },

    transferEnergyToAdjacentBuilders: function (carrier) {
        if (carrier.carry.energy > 0) {
            var adjacentNonFullBuilders = carrier.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: creep => creep.memory.role === ROLE_BUILDER && creep.carry.energy < creep.carryCapacity
            });
            _.forEach(adjacentNonFullBuilders, function (builder) {
                if (carrier.carry.energy > 0) {
                    carrier.transfer(builder, RESOURCE_ENERGY);
                }
            })
        }

    },

    getMiner: function (carrier) {
        var miner = Game.getObjectById(carrier.memory.minerId);

        if (miner) {
            if (!miner.memory.carrierId) {
                miner.memory.carrierId = carrier.id;
            }
            return miner;
        } else {
            // Miner not found, maybe destroyed in a fight, or broke down due to aging.

            var miners = carrier.room.find(FIND_MY_CREEPS, {
                filter: creep => creep.memory.role == ROLE_MINER
            });

            if (!miners.length) {
                // No miners available, just wait until some are made
                carrier.memory.minerId = null;
                carrier.memory.sourceId = null;
                return null;
            }

            _.forEach(miners, function (creep) {
                if (!Game.getObjectById(creep.memory.carrierId)) {
                    miner = creep;
                    return false;
                }
            });

            if (miner) {
                carrier.memory.minerId = miner.id;
                carrier.memory.sourceId = miner.memory.sourceId;
                miner.memory.carrierId = carrier.id;
                return miner;
            }

            // Link to an existing miner
            miner = carrier.pos.findClosestByPath(miners);
            // Don't override the carrier reference in the miner, as the current one is still valid
            carrier.memory.minerId = miner.id;
            carrier.memory.sourceId = miner.memory.sourceId;

            return miner;
        }
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};