var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (carrier) {

        carrier.pickupEnergyInRange();

        if (carrier.carry.energy >= 50 && carrier.room.hasSurplusEnergy()) {
            carrier.transferResourcesToAdjacentCreep(RESOURCE_ENERGY, ROLE_BUILDER);
        }

        if (_.sum(carrier.carry) === carrier.carryCapacity || carrier.ticksToLive < 50) {
            carrier.memory.inDeliveryMode = true;
            carrier.memory.pickupTargetId = null;
            carrier.memory.energyPileId = null;
        } else if (_.sum(carrier.carry) === 0) {
            carrier.memory.inDeliveryMode = false;
            carrier.memory.dropOffId = null;
        }

        if (carrier.memory.inDeliveryMode) {
            carrier.deliverEnergy();
        } else {
            // Picking up energy. Priorities:
            // 1. If spawn/extensions are not full, fill them from containers and storage
            // 2. Pickup stray piles of energy
            // 3. Go hang with the miner and wait for it to provide energy
            let pickupTarget = this.findPickupTarget(carrier);
            if (pickupTarget) {
                if (!carrier.pos.isNearTo(pickupTarget)) {
                    if (carrier.fatigue === 0) {
                        carrier.moveTo(pickupTarget);
                    }
                } else if (_.isFunction(pickupTarget.transfer)) {
                    pickupTarget.transfer(carrier, RESOURCE_ENERGY);
                }

                return;
            }

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
            }
        }
    },

    findPickupTarget: function (carrier) {
        var energyPile = Game.getObjectById(carrier.memory.energyPileId);
        if (energyPile) {
            return energyPile;
        }

        var pickupTarget;
        if (carrier.room.energyAvailable < carrier.room.energyCapacityAvailable) {
            pickupTarget = Game.getObjectById(carrier.memory.pickupTargetId);
            if (!pickupTarget || _.sum(pickupTarget.store) === 0) {
                pickupTarget = _.first(_.sortBy(carrier.room.find(FIND_STRUCTURES, {
                    filter: s => {
                        return (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER) &&
                                _.sum(s.store) > 0;
                    }
                }), s => 1 - _.sum(s.store) / s.storeCapacity));
            }
            carrier.memory.pickupTargetId = pickupTarget ? pickupTarget.id : null;
        }

        if (!pickupTarget) {
            pickupTarget = carrier.pos.findClosestByRange(FIND_DROPPED_ENERGY, {
                filter: pile => pile.amount / carrier.pos.getRangeTo(pile) > 15
            });
            carrier.memory.energyPileId = pickupTarget ? pickupTarget.id : null;
        }

        return pickupTarget;
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

    getMiner: function (carrier) {

        var miner = Game.getObjectById(carrier.memory.minerId);

        if (!carrier.memory.hasOwnMiner || !miner) {
            // Either working temporarily with a surrogate miner, or the miner
            // we just worked with died. Find a new one.

            var soloMiner = utils.findClosestSoloMiner(carrier.pos);
            if (soloMiner) {
                carrier.memory.minerId = soloMiner.id;
                carrier.memory.sourceId = soloMiner.memory.sourceId;
                carrier.memory.hasOwnMiner = true;
                return soloMiner;
            }

            // Find a surrogate miner and temporarily link to that,
            // until a new miner is built for the current source
            var miners = carrier.room.find(FIND_MY_CREEPS, {
                filter: creep => creep.memory.role === ROLE_MINER
            });
            // Work with the farthest off miner, as it probably needs the most help
            var farthestMiner = _.last(_.sortBy(miners, function (miner) {
                return carrier.pos.getRangeTo(miner);
            }));
            if (farthestMiner) {
                carrier.memory.minerId = farthestMiner.id;
                carrier.memory.sourceId = farthestMiner.memory.sourceId;
                carrier.memory.hasOwnMiner = false;
                return farthestMiner;
            }

            // No miners in the room, just chill
            return null;
        } else {
            // The carrier is linked to an existing miner
            return miner;
        }
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};