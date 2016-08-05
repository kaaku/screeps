var BaseRole = require('./role.base');
var _ = require('lodash');

function MedicRole() {
    BaseRole.apply(this, arguments);
}
MedicRole.super_ = BaseRole;
Object.setPrototypeOf(MedicRole.prototype, BaseRole.prototype);

MedicRole.prototype.run = function (medic) {
    var healTarget = this.getHealTarget(medic);

    if (healTarget && medic.canHeal() && medic.heal(healTarget) === ERR_NOT_IN_RANGE) {
        if (medic.canMove()) {
            medic.moveTo(healTarget);
        } else {
            medic.heal(medic);
        }
        return;
    }

    var occupationTarget = medic.memory.occupationTarget;
    if (occupationTarget && medic.memory.attackInProgress) {
        var occupationRallyPoint = medic.getOccupationRallyPoint();
        if (occupationRallyPoint && !medic.pos.isNearTo(occupationRallyPoint)) {
            medic.moveTo(occupationRallyPoint);
            return;
        }
    }

    var rallyPoint = medic.getRallyPoint();
    if (rallyPoint && !medic.pos.isNearTo(rallyPoint)) {
        medic.moveTo(rallyPoint);
    }
};

MedicRole.prototype.getHealTarget = function (medic) {
    var target = Game.getObjectById(medic.memory.healTarget);
    if (target && target.hits < target.hitsMax / 2) {
        // The target is under 50%, just keep healing
        return target;
    }

    target = _.first(_.sortBy(medic.room.find(FIND_MY_CREEPS, {
        filter: creep => creep.hits < creep.hitsMax
    }), creep => creep.hits / creep.hitsMax));

    if (target) {
        medic.memory.healTarget = target.id;
    }

    return target;
};

MedicRole.prototype.getBody = function (energy) {
    if (energy < BODYPART_COST[HEAL] + BODYPART_COST[MOVE]) {
        return null;
    }

    var heal = [], move = [], tough = [];
    var cheapestPart = _.min([BODYPART_COST[HEAL], BODYPART_COST[MOVE], BODYPART_COST[TOUGH]]);

    while (energy >= cheapestPart) {
        if (energy >= BODYPART_COST[MOVE] && move.length < heal.length + tough.length) {
            move.push(MOVE);
            energy -= BODYPART_COST[MOVE];
        } else if (energy >= BODYPART_COST[HEAL]) {
            heal.push(HEAL);
            energy -= BODYPART_COST[HEAL];
        } else if (energy >= BODYPART_COST[TOUGH]) {
            tough.push(TOUGH);
            energy -= BODYPART_COST[TOUGH];
        } else {
            break;
        }
    }

    var body = tough;
    while (move.length > 0 && heal.length > 0) {
        body.push(move.pop(), heal.pop());
    }
    if (move.length > 0) {
        body.push(move.pop());
    } else if (heal.length > 0) {
        body.push(heal.pop());
    }

    return body;
};

module.exports = new MedicRole();