var _ = require('lodash');

/**
 * Creates a new simple task object that contains data related to a task that needs to
 * be done. The returned object can be stored in memory.
 *
 * @param {String} type The type of the task, one of the TASK_* constants
 * @param {String} roomName The name of the room where the task target resides
 * @param {String} targetId The ID of the task target (structure or construction site)
 * @param {Number} priority The priority of the task, from 0 upwards. The smaller
 * the number, the sooner the task will get done
 * @constructor
 */
function Task(type, roomName, targetId, priority) {
    this.type = type;
    this.roomName = roomName;
    this.targetId = targetId;
    this.priority = priority;
    this.maxAssignees = TASKS_MAX_ASSIGNEES[type];
    this.assignees = [];
}

module.exports = {

    /**
     * Finds a new task for the given creep to work on.
     *
     * @param creep The creep to find a new task for
     * @returns {null|Task} A task for the creep to work on, or null if no tasks are
     * currently available
     */
    getNewTaskFor: function (creep) {
        var tasks = _.assign({}, this.getTasksForRoom(creep.room.name));

        var exits = Game.map.describeExits(creep.room.name);
        if (!_.isEmpty(exits)) {
            let adjacentRoomNames = _.filter(exits,
                    roomName => !_.has(Game.rooms, roomName) || (Game.rooms[roomName].isFriendlyOrNeutral()) &&
                    _.isEmpty(_.filter(Game.creeps,
                            creep => creep.memory.role === ROLE_BUILDER && creep.memory.homeRoom === roomName
                    )));
            if (!_.isEmpty(adjacentRoomNames)) {
                _.forEach(adjacentRoomNames, roomName => {
                    _.assign(tasks, this.getTasksForRoom(roomName));
                });
            }
        }


        if (!_.isEmpty(tasks)) {
            let minPrio = 999, tasksWithMinPrio = [];

            _.forEach(tasks, task => {
                if (this.isTaskValid(task) && (!_.isNumber(task.maxAssignees) ||
                        task.maxAssignees > 0 && task.assignees.length < task.maxAssignees)) {
                    // Tasks in adjacent rooms are considered less important
                    let effectivePrio = creep.room.name === task.roomName ?
                            task.priority : task.priority * TASK_PRIO_ADJACENT_ROOM_MULTIPLIER;
                    if (effectivePrio < minPrio) {
                        minPrio = task.priority;
                        tasksWithMinPrio = [task];
                    } else if (effectivePrio === minPrio) {
                        tasksWithMinPrio.push(task);
                    }
                }
            });

            let closestTask;
            let rangeToClosestTask = 50;

            _.forEach(tasksWithMinPrio, task => {
                let target = Game.getObjectById(task.targetId);
                let range = creep.pos.getRangeTo(target) || 50;
                if (_.isUndefined(closestTask) || range < rangeToClosestTask) {
                    closestTask = task;
                    rangeToClosestTask = range;
                }
            });

            if (closestTask) {
                closestTask.assignees.push(creep.id);
                return closestTask;
            }
        }

        return null;
    },

    /**
     * This method should be invoked when a creep stops working on a task.
     *
     * @param {String} assigneeId The ID of the creep that was working on the task
     * @param {Task} task The task the creep was working on
     */
    stopWorkOnTask: function (assigneeId, task) {
        if (_.isString(assigneeId) && _.isObject(task) && _.has(task, 'targetId') &&
                _.has(task, 'roomName') && _.has(Memory.rooms, task.roomName)) {
            let tasks = Memory.rooms[task.roomName].tasks;
            if (_.has(tasks, task.targetId) && _.isArray(tasks[task.targetId].assignees)) {
                _.remove(tasks[task.targetId].assignees, id => id === assigneeId);
            }
        }
    },

    /**
     * Determines if the given task is still valid. E.g. for repairing tasks, checks
     * that the structure still exists and does not have full hits.
     *
     * @param {Task} task The task to validate
     * @return {boolean} True, if the task is still valid, false otherwise
     */
    isTaskValid: function (task) {
        if (_.isEmpty(task)) {
            return false;
        }

        let target = Game.getObjectById(task.targetId);
        if (target === null) {
            return false;
        }

        if (task.type === TASK_BUILD && target instanceof ConstructionSite) {
            return true;
        }

        if (task.type === TASK_UPGRADE_CONTROLLER && target instanceof StructureController) {
            return true;
        }

        if (task.type === TASK_REPAIR && target instanceof Structure) {
            let targetHits = STRUCTURE_TARGET_HITS[target.structureType] || target.hitsMax;
            return target.hits < targetHits;
        }

        if (task.type === TASK_DELIVER_ENERGY && target instanceof StructureTower) {
            return target.energy < target.energyCapacity;
        }

        return false;
    },

    /**
     * Returns a hash of all tasks waiting to be done in the given room. The hash
     * keys are the unique IDs of the task target (construction site or structure),
     * and the values are instances of {@link Task}.
     *
     * All tasks are assigned a priority (a floating-point number). The smaller the
     * priority, the more urgent the task is. Priorities are assigned as follows:
     *
     * - Tower-related tasks always have a priority of 0, as these tasks are crucial
     * to the defence of the room.
     * - Construction site tasks have a priority between 0 and 1. New sites have a
     * priority of 1, and the priority approaches 0 as work on the site progresses.
     * - Repair tasks have a priority between 0.7 and 1.7.
     * - Controller upgrade tasks have a priority between 0.1 and 2.1.
     *
     * @param {String} roomName The name of the room whose tasks are resolved
     * @returns {Array<String, Task>} A hash of all tasks in the room
     */
    getTasksForRoom: function (roomName) {
        var room = Game.rooms[roomName];
        var roomMemory = Memory.rooms[roomName] || {};
        if (_.isUndefined(roomMemory.tasksUpdated)) {
            roomMemory.tasksUpdated = 0;
        }

        if (roomMemory.tasksUpdated < Game.time) {
            let oldTasks = roomMemory.tasks || {};
            let tasks = {};

            _.forEach(Game.constructionSites, site => {
                if (site.pos.roomName === roomName) {
                    // The priority of build tasks is inversely proportional to work left.
                    let priority = 1 - site.progress / site.progressTotal + TASK_MIN_PRIO_BUILD;

                    tasks[site.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_BUILD, roomName, site.id, priority);
                }
            });

            if (!_.isUndefined(room)) {
                let towers = room.find(FIND_STRUCTURES, {
                    filter: s => {
                        return s.structureType === STRUCTURE_TOWER &&
                                (s.energy < s.energyCapacity || s.hits < s.hitsMax);
                    }
                });
                _.forEach(towers, tower => {
                    let hitsLeft = tower.hits / tower.hitsMax;
                    let energyLeft = tower.energy / tower.energyCapacity;
                    let taskType = hitsLeft < energyLeft ? TASK_REPAIR : TASK_DELIVER_ENERGY;
                    let task = oldTasks[tower.id] || new Task(taskType, roomName, tower.id, TASK_PRIO_TOWER_MAINTENANCE);
                    // Make sure the task type has been updated correctly if using the old task
                    task.type = taskType;

                    tasks[tower.id] = task;
                });

                var structuresNeedingRepair = room.find(FIND_STRUCTURES, {
                    filter: structure => {
                        let targetHits = STRUCTURE_TARGET_HITS[structure.structureType] || structure.hitsMax;
                        return structure.structureType !== STRUCTURE_TOWER && structure.hits < targetHits * 0.9;
                    }
                });
                _.forEach(structuresNeedingRepair, structure => {
                    // The priority of repair tasks is inversely proportional to remaining hits.
                    let targetHits = STRUCTURE_TARGET_HITS[structure.structureType] || structure.hitsMax;
                    let priority = structure.hits / targetHits + TASK_MIN_PRIO_REPAIR;

                    tasks[structure.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_REPAIR,
                            roomName, structure.id, priority);
                });

                if (room.controller && room.controller.my) {
                    // The priority of upgrade tasks is inversely proportional to ticks remaining
                    // in the downgrade timer. The remaining tick percentage is multiplied with 2
                    // so that the priority range of upgrade jobs becomes TASK_MIN_PRIO_UPGRADE + 2.
                    // This way, upgrade jobs take precedence over most jobs when the downgrade
                    // timer runs very low, but allow all other jobs to be performed when the timer
                    // has recently been reset.
                    let controller = room.controller;
                    let ticksRemaining = controller.ticksToDowngrade / CONTROLLER_DOWNGRADE[controller.level];
                    let priority = ticksRemaining * 2 + TASK_MIN_PRIO_UPGRADE;

                    tasks[controller.id] = this.updateOldTaskOrCreateNew(oldTasks, TASK_UPGRADE_CONTROLLER,
                            roomName, controller.id, priority);
                }
            }

            roomMemory.tasks = tasks;
            roomMemory.tasksUpdated = Game.time;
            Memory.rooms[roomName] = roomMemory;
        }

        return roomMemory.tasks;
    },

    updateOldTaskOrCreateNew: function (oldTasks, taskType, roomName, targetId, priority) {
        if (_.has(oldTasks, targetId)) {
            let task = oldTasks[targetId];
            task.priority = priority;
            _.remove(task.assignees, id => _.isEmpty(Game.getObjectById(id)));
            return task;
        } else {
            return new Task(taskType, roomName, targetId, priority);
        }
    }
};