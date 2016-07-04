global.ROLE_HARVESTER = 'harvester';
global.ROLE_MINER = 'miner';
global.ROLE_CARRIER = 'carrier';
global.ROLE_BUILDER = 'builder';
global.ROLE_SOLDIER_MELEE = 'soldierMelee';
global.ROLE_SOLDIER_MEDIC = 'soldierMedic';
global.ROLE_SCOUT = 'scout';

global.ROLES = {
    [ROLE_HARVESTER]: require('./role.harvester'),
    [ROLE_MINER]: require('./role.miner'),
    [ROLE_CARRIER]: require('./role.carrier'),
    [ROLE_BUILDER]: require('./role.builder'),
    [ROLE_SOLDIER_MELEE]: require('./role.soldier_melee'),
    [ROLE_SOLDIER_MEDIC]: require('./role.soldier_medic'),
    [ROLE_SCOUT]: require('./role.scout')
};