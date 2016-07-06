var _ = require('lodash');

module.exports = {

    /** @param {Creep} builder **/
    run: function (builder) {

        builder.pickupEnergyInRange();

        if (builder.memory.building && builder.carry.energy === 0) {
            builder.memory.building = false;
        } else if (!builder.memory.building && builder.carry.energy === builder.carryCapacity) {
            builder.memory.building = true;
        }

        if (builder.memory.building) {
            if (builder.room.controller.ticksToDowngrade < 1000) {
                // Controller about to downgrade; this takes priority
                this.upgradeController(builder);
            }

            // Building mode on; build something or upgrade the controller

            var site = Game.getObjectById(builder.memory.constructionSiteId);
            if (!site) {
                // No construction site in memory; find the closest started one,
                // or if none are started, just the closest one
                site = builder.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, {
                            filter: site => site.progress > 0
                        }) || builder.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
                builder.memory.constructionSiteId = site ? site.id : null;
            }

            if (site) {
                if (!builder.pos.inRangeTo(site, 3)) {
                    builder.moveTo(site);
                } else {
                    builder.build(site);
                }

                return;
            }

            var repairTarget = this.findRepairTarget(builder);
            if (repairTarget) {
                if (!builder.pos.inRangeTo(repairTarget, 3)) {
                    builder.moveTo(repairTarget);
                } else {
                    builder.repair(repairTarget);
                }
            } else {
                this.upgradeController(builder);
            }
        } else {
            // Energy pickup mode
            var pickupTarget = this.findClosestEnergyPickup(builder);

            if (pickupTarget) {
                if (!builder.pos.isNearTo(pickupTarget)) {
                    builder.moveTo(pickupTarget);
                } else {
                    builder.requestEnergyFrom(pickupTarget);
                }
            }
        }
    },

    findClosestEnergyPickup: function (builder) {
        var pickup = Game.getObjectById(builder.memory.pickupId);
        if (pickup && pickup.hasEnergy()) {
            return pickup;
        }

        var structures = builder.room.find(FIND_STRUCTURES, {
            filter: structure => {
                return structure.isFriendlyOrNeutral() && structure.hasEnergy() &&
                        structure.structureType !== STRUCTURE_TOWER;
            }
        });

        var storagesAndContainers = _.filter(structures, s => {
            return s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER;
        });
        if (!_.isEmpty(storagesAndContainers)) {
            pickup = builder.pos.findClosestByRange(storagesAndContainers);
        } else {
            pickup = builder.pos.findClosestByRange(structures);
        }

        if (pickup) {
            builder.memory.pickupId = pickup.id;
        }

        return pickup;
    },

    findRepairTarget: function (builder) {
        var closestWeakOwnedStructure = builder.pos.findClosestByRange(FIND_MY_STRUCTURES, {
            filter: structure => structure.hits / structure.hitsMax < 0.5
        });
        if (closestWeakOwnedStructure) {
            return closestWeakOwnedStructure;
        }

        // TODO: Make wall hit point threshold dynamic
        var closestWeakNeutralStructure = builder.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: structure => {
                return (_.includes([STRUCTURE_ROAD, STRUCTURE_CONTAINER], structure.structureType) &&
                        structure.hits / structure.hitsMax < 0.5) ||
                        (structure.structureType === STRUCTURE_WALL && structure.hits < 100000)
            }
        });
        if (closestWeakNeutralStructure) {
            return closestWeakNeutralStructure;
        }

        return null;
    },

    upgradeController: function (builder) {
        var controller = builder.room.controller;
        if (!builder.pos.inRangeTo(controller, 3)) {
            builder.moveTo(controller);
        } else {
            builder.upgradeController(controller);
        }
    },

    getBody: function (energy) {
        if (energy < BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) {
            return null;
        }

        var move = [], carry = [], work = [];
        var cheapestPart = _.min([BODYPART_COST[MOVE], BODYPART_COST[CARRY], BODYPART_COST[WORK]]);
        while (energy >= cheapestPart) {
            if (energy >= BODYPART_COST[WORK] && work.length <= carry.length) {
                energy = this.addPart(energy, work, WORK);
            } else if (energy >= BODYPART_COST[MOVE] && move.length < work.length) {
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
