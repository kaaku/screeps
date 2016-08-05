var BaseRole = require('./role.base');
var _ = require('lodash');
var utils = require('./utils');
var taskManager = require('./manager.tasks');

function BuilderRole() {
    BaseRole.apply(this, arguments);
}
BuilderRole.super_ = BaseRole;
Object.setPrototypeOf(BuilderRole.prototype, BaseRole.prototype);

/** @param {Creep} builder **/
BuilderRole.prototype.run = function (builder) {

    builder.pickupEnergyInRange();

    if (builder.memory.renew && builder.ticksToLive > CREEP_LIFE_TIME * 0.5) {
        delete builder.memory.renew;
    }

    if (builder.carry.energy === 0) {
        builder.memory.working = false;
        if (_.isObject(builder.memory.task)) {
            let task = builder.memory.task;
            builder.log(`Stopping work on ${task.type} task ${task.targetId}`);
            taskManager.stopWorkOnTask(builder.id, task);
            delete builder.memory.task;
        }
        if (builder.ticksToLive < CREEP_LIFE_TIME * 0.1 && !builder.isObsolete()) {
            builder.memory.renew = true;
        }
    } else if (builder.carry.energy === builder.carryCapacity) {
        builder.memory.working = true;
        delete builder.memory.pickupId;
    }

    if (builder.memory.renew) {
        if (builder.room.name !== builder.memory.homeRoom) {
            builder.moveTo(new RoomPosition(25, 25, builder.memory.homeRoom));
        } else {
            let spawn = builder.pos.findClosestByRange(FIND_MY_SPAWNS);
            if (!builder.pos.isNearTo(spawn)) {
                builder.moveTo(spawn);
            }
        }
    } else if (builder.memory.working) {
        let task = builder.memory.task;
        if (_.isUndefined(task) || !taskManager.isTaskValid(task)) {
            task = taskManager.getNewTask(builder);
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
};

BuilderRole.prototype.performTask = function (builder, task) {
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
};

BuilderRole.prototype.findClosestEnergyPickup = function (builder) {
    var pickup = Game.getObjectById(builder.memory.pickupId);
    if (pickup && pickup.hasEnergy()) {
        return pickup;
    }

    var energyPiles = builder.pos.findInRange(FIND_DROPPED_ENERGY, 4, {filter: pile => pile.hasEnergy()});
    if (!_.isEmpty(energyPiles)) {
        pickup = builder.pos.findClosestByRange(energyPiles);
    } else {
        if (_.isString(builder.memory.homeRoom) && builder.memory.homeRoom !== builder.room.name &&
                builder.room.energyAvailable < builder.carryCapacity - _.sum(builder.carry)) {
            // Go back home to fetch more resources
            return new RoomPosition(25, 25, builder.memory.homeRoom);
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
    }

    if (pickup) {
        builder.memory.pickupId = pickup.id;
    }

    return pickup;
};

BuilderRole.prototype.getBody = function (energy) {
    if (energy < BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) {
        return null;
    }

    var move = [], carry = [], work = [];
    var cheapestPart = _.min([BODYPART_COST[MOVE], BODYPART_COST[CARRY], BODYPART_COST[WORK]]);
    while (energy >= cheapestPart && move.length + carry.length + work.length < MAX_CREEP_SIZE) {
        if (energy >= BODYPART_COST[WORK] && work.length <= carry.length) {
            work.push(WORK);
            energy -= BODYPART_COST[WORK];
        } else if (energy >= BODYPART_COST[MOVE] && move.length < work.length) {
            move.push(MOVE);
            energy -= BODYPART_COST[MOVE];
        } else if (energy >= BODYPART_COST[CARRY]) {
            carry.push(CARRY);
            energy -= BODYPART_COST[CARRY];
        } else {
            break;
        }
    }

    return work.concat(carry).concat(move);
};

module.exports = new BuilderRole();
