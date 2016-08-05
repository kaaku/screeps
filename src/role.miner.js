var BaseRole = require('./role.base');
var _ = require('lodash');
var utils = require('./utils');

function MinerRole() {
    BaseRole.apply(this, arguments);
}
MinerRole.super_ = BaseRole;
Object.setPrototypeOf(MinerRole.prototype, BaseRole.prototype);

MinerRole.prototype.run = function (miner) {

    var carrier = this.getCarrier(miner);

    if (miner.carry.energy >= 50) {
        miner.transferResourcesToAdjacentCreep(RESOURCE_ENERGY,
                (miner.room.hasSurplusEnergy() ? [ROLE_CARRIER, ROLE_BUILDER] : ROLE_CARRIER));
    }

    if (_.sum(miner.carry) === miner.carryCapacity) {
        if (!carrier) {
            // No carrier available; the miner needs to deliver the energy on its own
            miner.memory.inDeliveryMode = true;
        } else {
            // A carrier exists; just dump everything and trust it gets picked up
            miner.drop(RESOURCE_ENERGY);
        }
    } else if (_.sum(miner.carry) === 0) {
        miner.memory.inDeliveryMode = false;
        miner.memory.dropOffId = null;
    }

    if (miner.memory.inDeliveryMode) {
        miner.deliverEnergy();
    } else {
        this.harvestResources(miner, carrier !== null);
    }
};

MinerRole.prototype.getBody = function (energy) {
    if (energy < BODYPART_COST[CARRY] + BODYPART_COST[MOVE] + BODYPART_COST[WORK]) {
        return null;
    }

    var work = [], carry = [], move = [];
    var cheapestPart = _.min([BODYPART_COST[CARRY], BODYPART_COST[MOVE], BODYPART_COST[WORK]]);

    while (energy >= cheapestPart && move.length + carry.length + work.length < MAX_CREEP_SIZE) {
        if (!move.length) {
            move.push(MOVE);
            energy -= BODYPART_COST[MOVE];
        } else if (energy >= BODYPART_COST[WORK] && work.length < 5 && work.length <= 3 * carry.length) {
            // 5 WORK parts is enough to deplete an energy source
            work.push(WORK);
            energy -= BODYPART_COST[WORK];
        } else if (energy >= BODYPART_COST[CARRY] && carry.length <= 2) {
            // No need to add more than 2 CARRY parts; these are only needed when there's no carrier available
            carry.push(CARRY);
            energy -= BODYPART_COST[CARRY];
        } else {
            break;
        }
    }

    return work.concat(carry).concat(move);
};

MinerRole.prototype.harvestResources = function (miner, hasCarrier) {
    var source = Game.getObjectById(miner.memory.sourceId);
    var container = this.getContainer(miner);

    if (container && !miner.pos.isEqualTo(container.pos)) {
        miner.moveTo(container);
    } else if (!miner.pos.isNearTo(source)) {
        miner.moveTo(source);
    } else {
        if (!hasCarrier && container && container.store.energy > 0) {
            // No carrier available -> take the resources from the container and deliver them
            container.transfer(miner, RESOURCE_ENERGY);
        } else {
            miner.harvest(source);

            if (!container) {
                var constructionSiteExists = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                            filter: site => site.structureType === STRUCTURE_CONTAINER
                        }).length > 0;
                if (!constructionSiteExists) {
                    // No container built and no construction site created -> create a site
                    miner.pos.createConstructionSite(STRUCTURE_CONTAINER);
                }
            }
        }
    }
};

MinerRole.prototype.getContainer = function (miner) {
    var container = Game.getObjectById(miner.memory.containerId);

    if (!container) {
        var source = Game.getObjectById(miner.memory.sourceId);
        if (source) {
            container = _.first(source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: structure => structure.structureType === STRUCTURE_CONTAINER
            }));

            if (container) {
                miner.memory.containerId = container.id;

                // Save the container in the room memory as a drop off container
                var roomMemory = miner.room.memory;
                if (_.isUndefined(roomMemory.dropOffContainerIds)) {
                    roomMemory.dropOffContainerIds = [];
                }
                if (!_.contains(roomMemory.dropOffContainerIds, container.id)) {
                    miner.log(`Registering container ${container.id} at (${container.pos.x}, ${container.pos.y}) as a drop off point`);
                    roomMemory.dropOffContainerIds.push(container.id);
                }
            }
        }
    }

    return container;
};

/**
 * Returns the carrier that is assigned as the pair of this miner, or null if no such
 * carrier exists. If there are multiple such carriers, returns the closest one.
 *
 * @param {Creep} miner
 */
MinerRole.prototype.getCarrier = function (miner) {
    var carrier = Game.getObjectById(miner.memory.carrierId);

    if (!carrier || carrier.memory.minerId !== miner.id) {
        // Carriers can switch the miner they work with in certain cases, so it's
        // important to check that the carrier is still linked to this miner
        carrier = miner.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: creep => creep.memory.role === ROLE_CARRIER && creep.memory.sourceId === miner.memory.sourceId
        });
    }

    miner.memory.carrierId = carrier ? carrier.id : null;

    return carrier;
};

module.exports = new MinerRole();