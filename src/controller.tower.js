var _ = require('lodash');
var taskManager = require('./manager.tasks');

module.exports = {

    /**
     * @param {StructureTower} tower
     */
    run: function (tower) {
        if (tower.energy >= TOWER_ENERGY_COST) {
            var attackTarget = this.getAttackTarget(tower);
            if (attackTarget) {
                tower.attack(attackTarget);
            } else if (tower.energy / tower.energyCapacity >= TOWER_REPAIR_ENERGY_THRESHOLD) {
                let repairTarget = this.getRepairTarget(tower);
                if (repairTarget) {
                    tower.repair(repairTarget);
                }
            }
        }
    },

    getAttackTarget: function (tower) {
        var target = Game.getObjectById(tower.getFromMemory('attackTargetId'));
        if (target && (target.canAttack() || target.canHeal())) {
            return target;
        }

        var hostiles = tower.room.find(FIND_HOSTILE_CREEPS);
        if (_.isEmpty(hostiles)) {
            target = null;
        } else {
            var offensiveHostiles = _.filter(hostiles, creep => creep.canAttack() || creep.canHeal());
            target = _.isEmpty(offensiveHostiles) ?
                    tower.pos.findClosestByRange(hostiles) : tower.pos.findClosestByRange(offensiveHostiles);
        }

        if (target) {
            console.log(`Found new attack target at (${target.pos.x}, ${target.pos.y}) with body ` +
                    `${_.map(target.body, 'type')}, gunning down!`);
            tower.setToMemory('attackTargetId', target.id);
        } else {
            tower.clearFromMemory('attackTargetId');
        }

        return target;
    },

    getRepairTarget: function (tower) {
        var task = tower.getFromMemory('repairTask');
        var repairTarget = null;
        if (task) {
            repairTarget = Game.getObjectById(task.targetId);
            if (repairTarget && repairTarget.hits / repairTarget.getTargetHits() < TASKS_REPAIR_THRESHOLD) {
                return repairTarget;
            } else {
                // Stop repair work eagerly with towers, as it's so ineffective
                taskManager.stopWorkOnTask(tower.id, task);
                tower.clearFromMemory('repairTask');
                repairTarget = null;
            }
        }

        task = taskManager.getNewTask(tower, TASK_REPAIR, false);
        if (task) {
            repairTarget = Game.getObjectById(task.targetId);
            tower.setToMemory('repairTask', task);
        }

        return repairTarget;
    }
};