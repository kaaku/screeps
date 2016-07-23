var _ = require('lodash');
var utils = require('./utils');

module.exports = {

    /**
     * Executes room-level tasks, e.g. building structures and roads.
     *
     * @param {Room} room The room whose tasks to take care of
     */
    run: function (room) {
        if (Game.time % 20 === 0 && _.keys(Game.constructionSites).length < MAX_CONSTRUCTION_SITES &&
                room.find(FIND_CONSTRUCTION_SITES).length <= 20 &&
                room.find(FIND_MY_CREEPS, {
                    filter: c => c.memory.role === ROLE_BUILDER && c.memory.homeRoom === room.name
                }).length > 0) {
            if (utils.canBuildStructure(STRUCTURE_ROAD, room)) {
                _.forEach(room.find(FIND_MY_SPAWNS), spawn => {

                    this.buildRoadsAroundSpawn(spawn);

                    _.forEach(room.find(FIND_SOURCES), source => {
                        this.buildRoad(spawn, source);
                    });

                    this.buildRoad(spawn, room.controller);
                });
            }
        }
    },

    /**
     * Surrounds the given spawn with roads (or, constructions sites for roads).
     *
     * @param {StructureSpawn} spawn The spawn to surround
     */
    buildRoadsAroundSpawn: function (spawn) {
        if (spawn.memory.hasSurroundingRoads || _.keys(Game.constructionSites).length + 9 > MAX_CONSTRUCTION_SITES) {
            // Roads have already been built, or there are too many construction sites already
            return;
        }

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
    },

    /**
     * Creates constructions sites for roads between the given points.
     * The points have to be in the same room or in adjacent rooms.
     *
     * @param {ConstructionSite|Source|Structure} start Start point of the road
     * @param {ConstructionSite|Source|Structure} end End point of the road
     */
    buildRoad: function (start, end) {
        let memoryKey = `${start.id}_${end.id}`, inverseMemoryKey = `${end.id}_${start.id}`;
        if (_.has(Memory.rooms[start.pos.roomName].paths, memoryKey) ||
                _.has(Memory.rooms[start.pos.roomName].paths, inverseMemoryKey)) {
            // This path is already established, no need to do anything
            return;
        }

        var path = start.pos.findPathTo(end.pos, {
            ignoreCreeps: true,
            ignoreRoads: true
        });

        if (_.keys(Game.constructionSites).length + path.length > MAX_CONSTRUCTION_SITES) {
            console.log(`Can't build road between ${start.pos} and ${end.pos}, too many construction sites`);
            return;
        }

        _.forEach(path, step => {
            let pos = new RoomPosition(step.x, step.y, start.pos.roomName);
            if (_.isEmpty(pos.lookFor(LOOK_CONSTRUCTION_SITES)) &&
                    _.isEmpty(_.filter(pos.lookFor(LOOK_STRUCTURES),
                            s => s.structureType === STRUCTURE_ROAD))) {
                console.log(`${start.pos.roomName}: Building road at (${step.x}, ${step.y})`);
                pos.createConstructionSite(STRUCTURE_ROAD);
            }
        });

        Memory.rooms[start.pos.roomName].paths[memoryKey] = true;

        if (start.pos.roomName !== end.pos.roomName) {
            // Points are in different rooms, findPathTo() only goes to the room border.
            // In order to complete the road the other half needs to be built as well.
            this.buildRoad(end, start);
        }
    }
};