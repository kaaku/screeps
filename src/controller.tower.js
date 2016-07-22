var _ = require('lodash');

module.exports = {

    /**
     * @param {StructureTower} tower
     */
    run: function (tower) {
        if (tower.energy >= TOWER_ENERGY_COST) {
            var attackTarget = this.getAttackTarget(tower);
            if (attackTarget) {
                tower.attack(attackTarget);
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
            console.log(`Found new attack target at (${target.pos.x}, ${target.pos.y}) with body ${_.map(target.body, 'type')}, gunning down!`);
            tower.setToMemory('attackTargetId', target.id);
        } else {
            tower.clearFromMemory('attackTargetId');
        }

        return target;
    }
};