var _ = require('lodash');
var utils = require('./utils');
var taskManager = require('./manager.tasks');

module.exports = {

    /** @param {Creep} builder **/
    run: function (builder) {

        builder.pickupEnergyInRange();

        if (builder.carry.energy === 0) {
            builder.memory.working = false;
            if (_.isObject(builder.memory.task)) {
                let task = builder.memory.task;
                builder.log(`Stopping work on ${task.type} task ${task.targetId}`);
                taskManager.stopWorkOnTask(builder.id, task);
                delete builder.memory.task;
            }
        } else if (builder.carry.energy === builder.carryCapacity) {
            builder.memory.working = true;
            delete builder.memory.pickupId;
        }

        if (builder.memory.working) {
            let task = builder.memory.task;
            if (_.isUndefined(task) || !taskManager.isTaskValid(task)) {
                task = taskManager.getNewTaskFor(builder);
                if (_.isObject(task)) {
                    builder.log(`Acquired a new task: ${JSON.stringify(task)}`);
                    builder.memory.task = task;
                }
            }

            if (task) {
                this.performTask(builder, task);
            } else {
                delete builder.memory.task;
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

    performTask: function (builder, task) {
        let target = Game.getObjectById(task.targetId);

        if (_.contains([TASK_BUILD, TASK_REPAIR, TASK_UPGRADE_CONTROLLER], task.type)) {
            let range = builder.pos.getRangeTo(target);

            if (range > 2 && builder.fatigue === 0) {
                // Move one square closer than necessary, so that other potential
                // workers can get in range easier
                builder.moveTo(target);
            }

            if (range <= 3) {
                // The task type name is the same as the corresponding method name
                builder[task.type](target);
            }
        } else if (task.type === TASK_DELIVER_ENERGY) {
            if (builder.pos.isNearTo(target)) {
                builder.transfer(target, RESOURCE_ENERGY);
            } else {
                builder.moveTo(target);
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
