var _ = require('lodash');

module.exports = {

    /**
     * @param {Creep} soldier
     */
    run: function (soldier) {
        if (soldier.canAttack()) {
            var attackTarget = this.getAttackTarget(soldier);
            if (attackTarget) {
                if (soldier.attack(attackTarget) === ERR_NOT_IN_RANGE) {
                    soldier.moveTo(attackTarget);
                }
                return;
            }
        } else {
            // Weapons are broken, try to find a medic and go to it
            var medic = this.getMedic(soldier);
            if (medic) {
                soldier.moveTo(medic);
                return;
            }
        }

        var occupationTarget = soldier.memory.occupationTarget;
        if (occupationTarget && soldier.memory.attackInProgress) {
            var occupationRallyPoint = soldier.getOccupationRallyPoint();
            if (occupationRallyPoint && !soldier.pos.isNearTo(occupationRallyPoint)) {
                soldier.moveTo(occupationRallyPoint);
                return;
            }
        }

        var rallyPoint = soldier.getRallyPoint();
        if (rallyPoint) {
            soldier.moveTo(rallyPoint);
        }
    },

    getAttackTarget: function (soldier) {
        var target = Game.getObjectById(soldier.memory.attackTarget);
        if (target && (target.canAttack() || target.canHeal())) {
            return target;
        }

        var enemySoldier = _.first(_.sortBy(soldier.room.find(FIND_HOSTILE_CREEPS, {
            filter: creep => creep.canAttack() || creep.canHeal()
        }), creep => creep.getFightingStrength() * (creep.hitsMax / creep.hits) / soldier.pos.getRangeTo(creep)));

        var tower = soldier.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: structure => structure.structureType === STRUCTURE_TOWER && structure.canAttack()
        });

        if (enemySoldier && tower) {
            target = soldier.pos.getRangeTo(enemySoldier) < soldier.pos.getRangeTo(tower) ? enemySoldier : tower;
        } else if (enemySoldier && !tower) {
            target = enemySoldier;
        } else if (tower && !enemySoldier) {
            target = tower;
        } else {
            // No enemy soldiers or towers in the room, find something else to destroy
            var closestHostile = soldier.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile) {
                target = closestHostile;
            } else {
                target = soldier.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
            }
        }

        if (target) {
            soldier.memory.attackTarget = target.id;
        }

        return target;
    },

    getMedic: function (soldier) {
        var medic = Game.getObjectById(soldier.memory.medicId);
        if (medic && soldier.pos.getRangeTo(medic) < 20) {
            return medic;
        }

        medic = soldier.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: creep => creep.canHeal()
        });
        if (medic) {
            soldier.memory.medicId = medic.id;
        }

        return medic;
    },

    getBody: function (energy) {
        if (energy < BODYPART_COST[ATTACK] + BODYPART_COST[MOVE]) {
            return null;
        }

        var attack = [], move = [], tough = [];
        var cheapestPart = _.min([BODYPART_COST[ATTACK], BODYPART_COST[MOVE], BODYPART_COST[TOUGH]]);

        while (energy >= cheapestPart) {
            if (energy >= BODYPART_COST[MOVE] && move.length < attack.length + tough.length) {
                energy = this.addPart(energy, move, MOVE);
            } else if (energy >= BODYPART_COST[ATTACK]) {
                energy = this.addPart(energy, attack, ATTACK);
            } else if (energy >= BODYPART_COST[TOUGH]) {
                energy = this.addPart(energy, tough, TOUGH);
            } else {
                break;
            }
        }

        var body = tough;
        while (move.length > 0 && attack.length > 0) {
            body.push(move.pop(), attack.pop());
        }
        if (move.length > 0) {
            body.push(move.pop());
        } else if (attack.length > 0) {
            body.push(attack.pop());
        }

        return body;
    },

    addPart: function (energy, parts, part) {
        parts.push(part);
        return energy - BODYPART_COST[part];
    }
};