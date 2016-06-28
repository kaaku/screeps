var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (miner) {

        var carrier = this.getCarrier(miner);

        if (miner.carry.energy >= 50) {
            miner.transferResourcesToAdjacentCreeps(RESOURCE_ENERGY, ROLE_CARRIER);
            if (miner.room.hasSurplusEnergy()) {
                miner.transferResourcesToAdjacentCreeps(RESOURCE_ENERGY, ROLE_BUILDER);
            }
        }

        if (_.sum(miner.carry) === miner.carryCapacity) {
            if (!carrier) {
                // No carrier available; the miner needs to deliver the energy on its own
                miner.memory.inDeliveryMode = true;
            } else {
                // A carrier exists; just dump everything and trust it gets picked up
                miner.drop(RESOURCE_ENERGY);
            }
        } else if (_.sum(miner.carry) === 0) {
            miner.memory.inDeliveryMode = false;
            miner.memory.dropOffId = null;
        }

        if (miner.memory.inDeliveryMode) {
            var dropOff = Game.getObjectById(miner.memory.dropOffId) ||
                    utils.findClosestEnergyDropOff(miner.pos, STRUCTURE_CONTAINER);
            miner.memory.dropOffId = dropOff ? dropOff.id : null;
            if (dropOff) {
                if (!miner.pos.isNearTo(dropOff)) {
                    miner.moveTo(dropOff);
                } else {
                    miner.memory.dropOffId = null;
                    miner.transferResourcesToAdjacentStructures(RESOURCE_ENERGY, STRUCTURE_CONTAINER);
                }
            }

            return;
        }

        var source = Game.getObjectById(miner.memory.sourceId);
        if (source && miner.pos.isNearTo(source)) {
            if (!carrier) {
                // TODO: Temporary container handling
                var container = _.first(miner.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: structure => structure.structureType === STRUCTURE_CONTAINER && structure.store.energy > 0
                }));
                if (container) {
                    container.transfer(miner, RESOURCE_ENERGY);
                }
            } else {
                miner.harvest(source);
            }
        } else if (!miner.fatigue) {
            miner.moveTo(source);
        }
    },

    getBody: function (energy) {
        if (energy < BODYPART_COST[CARRY] + BODYPART_COST[MOVE] + BODYPART_COST[WORK]) {
            return null;
        }

        var work = [], carry = [], move = [];
        var cheapestPart = _.min([BODYPART_COST[CARRY], BODYPART_COST[MOVE], BODYPART_COST[WORK]]);

        while (energy >= cheapestPart) {
            if (!move.length) {
                energy = this.addPart(energy, move, MOVE);
            } else if (energy >= BODYPART_COST[WORK] && work.length <= 5 && work.length <= 3 * carry.length) {
                // 5 WORK parts is enough to deplete an energy source
                energy = this.addPart(energy, work, WORK);
            } else if (energy >= BODYPART_COST[CARRY] && carry.length <= 2) {
                // No need to add more than 2 CARRY parts; these are only needed when there's no carrier available
                energy = this.addPart(energy, carry, CARRY);
            } else {
                break;
            }
        }

        return work.concat(carry).concat(move);
    },

    /**
     * Returns the carrier that is assigned as the pair of this miner, or null if no such
     * carrier exists. If there are multiple such carriers, returns the closest one.
     *
     * @param {Creep} miner
     */
    getCarrier: function (miner) {
        var carrier = Game.getObjectById(miner.memory.carrierId);

        if (!carrier || carrier.memory.minerId !== miner.id) {
            // Carriers can switch the miner they work with in certain cases, so it's
            // important to check that the carrier is still linked to this miner
            carrier = miner.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: creep => creep.memory.role === ROLE_CARRIER && creep.memory.sourceId === miner.memory.sourceId
            });
        }

        miner.memory.carrierId = carrier ? carrier.id : null;

        return carrier;
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};