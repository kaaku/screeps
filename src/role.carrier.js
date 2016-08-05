var BaseRole = require('./role.base');
var _ = require('lodash');

function CarrierRole() {
    BaseRole.apply(this, arguments);
}
CarrierRole.super_ = BaseRole;
Object.setPrototypeOf(CarrierRole.prototype, BaseRole.prototype);

CarrierRole.prototype.run = function (carrier) {
    carrier.pickupEnergyInRange();

    if (carrier.carry.energy >= 50 && carrier.room.hasSurplusEnergy()) {
        carrier.transferResourcesToAdjacentCreep(RESOURCE_ENERGY, ROLE_BUILDER);
    }

    if (_.sum(carrier.carry) === carrier.carryCapacity || carrier.ticksToLive < 50) {
        carrier.memory.inDeliveryMode = true;
        delete carrier.memory.energyPileId;
        delete carrier.memory.pickupTargetId;
        delete carrier.memory.minerId;
    } else if (_.sum(carrier.carry) === 0) {
        carrier.memory.inDeliveryMode = false;
        delete carrier.memory.dropOffId;
    }

    if (carrier.memory.inDeliveryMode) {
        carrier.deliverEnergy();
    } else {
        // Picking up energy. Priorities:
        // 1. Pickup stray piles of energy
        // 2. If spawn/extensions are not full, fill them from containers and storage
        // 3. Go hang with a miner and wait for it to provide energy
        let pickupTarget = this.findPickupTarget(carrier);
        if (pickupTarget) {
            if (!carrier.pos.isNearTo(pickupTarget)) {
                if (carrier.fatigue === 0) {
                    carrier.moveTo(pickupTarget);
                }
            } else if (_.isFunction(pickupTarget.transfer)) {
                pickupTarget.transfer(carrier, RESOURCE_ENERGY);
            }
        }
    }
};

CarrierRole.prototype.findPickupTarget = function (carrier) {
    var energyPile = Game.getObjectById(carrier.memory.energyPileId);
    if (energyPile && energyPile.amount / carrier.pos.getRangeTo(energyPile) > 15) {
        return energyPile;
    } else {
        energyPile = carrier.pos.findClosestByRange(FIND_DROPPED_ENERGY, {
            filter: pile => pile.amount / carrier.pos.getRangeTo(pile) > 15
        });
        if (energyPile) {
            carrier.memory.energyPileId = energyPile.id;
            return energyPile;
        } else {
            delete carrier.memory.energyPileId;
        }
    }

    if (carrier.room.energyAvailable < carrier.room.energyCapacityAvailable) {
        let pickupTarget = Game.getObjectById(carrier.memory.pickupTargetId);
        if (pickupTarget && pickupTarget.hasEnergy()) {
            return pickupTarget;
        }

        var energyStores = carrier.room.find(FIND_STRUCTURES, {
            filter: s => _.contains([STRUCTURE_STORAGE, STRUCTURE_CONTAINER], s.structureType) && s.hasEnergy()
        });

        if (!_.isEmpty(energyStores) && !_.isEmpty(carrier.room.memory.dropOffContainerIds)) {
            var dropOffContainers = _.filter(energyStores,
                    container => _.contains(carrier.room.memory.dropOffContainerIds, container.id));
            if (!_.isEmpty(dropOffContainers)) {
                energyStores = dropOffContainers;
            }
        }

        if (!_.isEmpty(energyStores)) {
            pickupTarget = _.first(_.sortBy(energyStores, s => 1 - _.sum(s.store) / s.storeCapacity));
            carrier.memory.pickupTargetId = pickupTarget.id;
            return pickupTarget;
        } else {
            delete carrier.memory.pickupTargetId;
        }
    }

    let miner = Game.getObjectById(carrier.memory.minerId);
    if (miner && miner.carry[RESOURCE_ENERGY] > 0) {
        return miner;
    }

    var miners = carrier.room.find(FIND_MY_CREEPS, {filter: c => c.memory.role === ROLE_MINER});
    if (!_.isEmpty(miners)) {
        miner = _.first(_.sortBy(miners, m => 1 - _.sum(m.carry) / m.carryCapacity));
        carrier.memory.minerId = miner.id;
        return miner;
    } else {
        delete carrier.memory.minerId;
    }

    return null;
};

CarrierRole.prototype.getBody = function (energy) {
    if (energy < BODYPART_COST[CARRY] + BODYPART_COST[MOVE]) {
        return null;
    }

    var carry = [], move = [];
    var cheapestPart = _.min([BODYPART_COST[CARRY], BODYPART_COST[MOVE]]);

    while (energy >= cheapestPart && move.length + carry.length < MAX_CREEP_SIZE) {
        if (energy >= BODYPART_COST[MOVE] && move.length <= carry.length) {
            move.push(MOVE);
            energy -= BODYPART_COST[MOVE];
        } else if (energy >= BODYPART_COST[CARRY]) {
            carry.push(CARRY);
            energy -= BODYPART_COST[CARRY];
        } else {
            break;
        }
    }

    return carry.concat(move);
};

module.exports = new CarrierRole();