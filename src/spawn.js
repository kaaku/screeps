module.exports = {
    run: function (spawn) {
        var room = spawn.room;

        if (room.energyAvailable === room.energyCapacityAvailable) {
            var harvesterCount = utils.countCreeps(room, ROLE_HARVESTER),
                soldierMeleeCount = utils.countCreeps(room, ROLE_SOLDIER_MELEE),
                medicCount = utils.countCreeps(room, ROLE_SOLDIER_MEDIC);
            if (harvesterCount === 0 || (harvesterCount === 1 &&
                soldierMeleeCount > 0 && medicCount > 0)) {
                this.build(spawn, ROLE_HARVESTER);
            } else if (soldierMeleeCount > 0 && medicCount === 0) {
                this.build(spawn, ROLE_SOLDIER_MEDIC);
            } else {
                this.build(spawn, ROLE_SOLDIER_MELEE);
            }
        }
    },

    build: function (spawn, role) {
        var body = Roles[role].getBody(spawn.room.energyAvailable);
        var result = spawn.createCreep(body, undefined, {role: role});
        if (_.isString(result)) {
            console.log('Built a new ' + role + ', ' + result + ' (' + body + ')');
        } else {
            console.log('Failed to build a new ' + role + ', error: ' + result);
        }
    }
};