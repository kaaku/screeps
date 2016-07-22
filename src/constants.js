global.ROLE_MINER = 'miner';
global.ROLE_CARRIER = 'carrier';
global.ROLE_BUILDER = 'builder';
global.ROLE_CLAIMER = 'claimer';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';
global.ROLE_SCOUT = 'scout';

global.ROLES = {
    [ROLE_MINER]: require('./role.miner'),
    [ROLE_CARRIER]: require('./role.carrier'),
    [ROLE_BUILDER]: require('./role.builder'),
    [ROLE_CLAIMER]: require('./role.claimer'),
    [ROLE_SOLDIER_MELEE]: require('./role.soldier_melee'),
    [ROLE_SOLDIER_MEDIC]: require('./role.soldier_medic'),
    [ROLE_SCOUT]: require('./role.scout')
};

/**
 * Contains the maximum hit point amounts that certain structure types should
 * be repaired to. Structure types not listed in this object are repaired to
 * their maximum hit points.
 *
 * @type {{String, Number}}
 */
global.STRUCTURE_TARGET_HITS = {
    [STRUCTURE_WALL]: 1000000,
    [STRUCTURE_RAMPART]: 2000000
};

global.TASK_BUILD = 'build';
global.TASK_REPAIR = 'repair';
global.TASK_UPGRADE_CONTROLLER = 'upgradeController';
global.TASK_DELIVER_ENERGY = 'deliverEnergy';

global.TASK_PRIO_TOWER_MAINTENANCE = 0;
global.TASK_MIN_PRIO_BUILD = 0;
global.TASK_MIN_PRIO_REPAIR = 0.7;
global.TASK_MIN_PRIO_UPGRADE = 0.1;

/**
 * A multiplier that is added to task priorities if the task is not in the
 * same room as the creep.
 *
 * @type {number}
 */
global.TASK_PRIO_ADJACENT_ROOM_MULTIPLIER = 1.5;

/**
 * Contains the maximum amount of assignees that can be assigned to a task of
 * a given type. Task types not listed in this object can have an unlimited
 * amount of assignees.
 *
 * @type {{String, Number}}
 */
global.TASKS_MAX_ASSIGNEES = {
    [TASK_BUILD]: 3,
    [TASK_REPAIR]: 1
};

