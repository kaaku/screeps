var _ = require('lodash');

module.exports = {

    /** @param {Creep} creep **/
    run: function (creep) {

        if (creep.memory.building && creep.carry.energy === 0) {
            creep.memory.building = false;
        } else if (!creep.memory.building && creep.carry.energy === creep.carryCapacity) {
            creep.memory.building = true;
        }

        if (creep.memory.building) {
            // Building mode on; build something or upgrade the controller

            var site = Game.getObjectById(creep.memory.constructionSiteId);
            if (!site) {
                // No construction site in memory; find the site that's closest to completion
                var sites = _.sortBy(creep.room.find(FIND_MY_CONSTRUCTION_SITES),
                        site => site.progress / site.progressTotal, 'desc');
                if (sites.length) {
                    site = sites[0];
                    creep.memory.constructionSiteId = site.id;
                } else {
                    creep.memory.constructionSiteId = null;
                }
            }

            if (site) {
                if (!creep.pos.inRangeTo(site, 3)) {
                    creep.moveTo(site);
                } else {
                    creep.build(site);
                }
            } else {
                var controller = creep.room.controller;
                if (!creep.pos.inRangeTo(controller, 3)) {
                    creep.moveTo(controller);
                } else {
                    creep.upgradeController(controller);
                }
            }
        } else {
            // Energy pickup mode

            // TODO: The pickup target ID should probably be cached
            var energyDeficit = creep.carryCapacity - _.sum(creep.carry);
            var pickupTarget = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                filter: structure => {
                    return ((structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN) &&
                            (structure.energy >= energyDeficit ||
                            structure.energy === structure.energyCapacity)) ||
                            ((structure.structureType === STRUCTURE_STORAGE ||
                            structure.structureType === STRUCTURE_CONTAINER) &&
                            (structure.store.energy >= energyDeficit ||
                            _.sum(structure.store) === structure.storeCapacity));
                }
            });

            if (pickupTarget) {
                if (!creep.pos.isNearTo(pickupTarget)) {
                    creep.moveTo(pickupTarget);
                } else {
                    creep.requestEnergyFrom(pickupTarget);
                }
            }
        }
    },

    getBody: function (energy) {
        if (energy < BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) {
            return null;
        }

        var move = [], carry = [], work = [];
        var cheapestPart = _.min([BODYPART_COST[MOVE], BODYPART_COST[CARRY], BODYPART_COST[WORK]]);
        while (energy >= cheapestPart) {
            if (energy >= BODYPART_COST[WORK] && (!work.length || work.length < 2 * carry.length)) {
                energy = this.addPart(energy, work, WORK);
            } else if (energy >= BODYPART_COST[MOVE] && (!move.length || move.length <= work.length)) {
                energy = this.addPart(energy, move, MOVE);
            } else if (energy >= BODYPART_COST[CARRY]) {
                energy = this.addPart(energy, carry, CARRY);
            } else {
                break;
            }
        }

        return work.concat(carry).concat(move);
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};
