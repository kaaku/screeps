var _ = require('lodash');

module.exports = {

    /**
     * Executes room-level tasks, e.g. building structures and roads.
     *
     * @param {Room} room The room whose tasks to take care of
     */
    run: function (room) {
        _.forEach(room.find(FIND_MY_SPAWNS), spawn => {
            if (!spawn.memory.hasSurroundingRoads &&
                    _.keys(Game.constructionSites).length + 9 <= MAX_CONSTRUCTION_SITES) {
                this.buildRoadsAroundSpawn(spawn);
            }
        });
    },

    buildRoadsAroundSpawn: function (spawn) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx !== 0 || dy !== 0) {
                    let x = spawn.pos.x + dx, y = spawn.pos.y + dy;
                    let pos = spawn.room.getPositionAt(x, y);
                    if (_.isEmpty(pos.lookFor(LOOK_CONSTRUCTION_SITES)) &&
                            _.isEmpty(_.filter(pos.lookFor(LOOK_STRUCTURES),
                                    s => s.structureType === STRUCTURE_ROAD))) {
                        spawn.room.log(`Building road around spawn ${spawn.name} at (${x}, ${y})`);
                        pos.createConstructionSite(STRUCTURE_ROAD);
                    }
                }
            }
        }

        spawn.memory.hasSurroundingRoads = true;
    }
};