var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    run: function (miner) {

        var carrier = this.getCarrier(miner);

        if (carrier && miner.carry.energy > 0 && miner.pos.isNearTo(carrier) &&
                _.sum(carrier.carry) < carrier.carryCapacity) {
            miner.transfer(carrier, RESOURCE_ENERGY);
        }

        if (miner.carryCapacity - miner.carry.energy < miner.getActiveBodyparts(WORK) * HARVEST_POWER * 0.5) {
            // Over half of the work capacity of this miner is about to go to waste -> dump resources
            if (carrier) {
                // A carrier exists; just dump everything on the ground and trust it gets picked up
                miner.drop(RESOURCE_ENERGY);
            } else {
                // No carrier found -> take the energy to closest structure
                var dropOff = utils.findClosestEnergyDropOff(miner.pos);
                if (dropOff) {
                    if (!miner.pos.isNearTo(dropOff)) {
                        miner.moveTo(dropOff);
                    }

                    if (miner.pos.isNearTo(dropOff)) {
                        miner.transfer(dropOff, RESOURCE_ENERGY);
                    }
                }

                return;
            }
        }

        var source = Game.getObjectById(miner.memory.sourceId);
        if (source && miner.pos.isNearTo(source)) {
            miner.harvest(source);
        } else {
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
            } else if (energy >= BODYPART_COST[WORK] && work.length <= 3 * carry.length) {
                energy = this.addPart(energy, work, WORK);
            } else if (energy >= BODYPART_COST[CARRY]) {
                energy = this.addPart(energy, carry, CARRY);
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
        return miner.pos.findClosestByPath(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role === ROLE_CARRIER && creep.memory.sourceId === miner.memory.sourceId
        });
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};