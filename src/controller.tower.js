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
        } else {
            // TODO: Come up with a formula to wage between distance and remaining health of the targets
            var attackTargets = tower.pos.findInRange(FIND_HOSTILE_CREEPS, 10, {
                filter: creep => creep.canAttack() || creep.canHeal()
            });
            target = _.first(_.sortBy(attackTargets, function (target) {
                // TODO: Is hit points a good selection criteria? What about e.g. damage output?
                return target.hits / target.hitsMax;
            }));

            if (target) {
                console.log(`Found new attack target at (${target.pos.x}, ${target.pos.y}) with body ${_.map(target.body, 'type')}, gunning down!`);
                tower.setToMemory('attackTargetId', target.id);
            } else {
                tower.clearFromMemory('attackTargetId');
            }

            return target;
        }
    }
};