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

            if (utils.canBuildStructure(STRUCTURE_EXTENSION, room)) {
                let spawn = this.getSpawnWithMostFreeSpace(room);

                if (spawn) {
                    this.buildExtensionsAroundSpawn(spawn);
                }
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

        spawn.room.log(`Building road around spawn ${spawn.name}`);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx !== 0 || dy !== 0) {
                    let x = spawn.pos.x + dx, y = spawn.pos.y + dy;
                    let pos = spawn.room.getPositionAt(x, y);
                    if (_.isEmpty(pos.lookFor(LOOK_CONSTRUCTION_SITES)) &&
                            _.isEmpty(_.filter(pos.lookFor(LOOK_STRUCTURES),
                                    s => s.structureType === STRUCTURE_ROAD))) {
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

        var path = start.pos.findPathTo(end.pos, {ignoreCreeps: true});

        if (_.keys(Game.constructionSites).length + path.length > MAX_CONSTRUCTION_SITES) {
            console.log(`Can't build road between ${start.pos} and ${end.pos}, too many construction sites`);
            return;
        }

        let startX = start.pos.x, startY = start.pos.y, endX = _.last(path).x, endY = _.last(path).y;
        console.log(`${start.pos.roomName}: Building road from (${startX}, ${startY}) to (${endX}, ${endY})`);

        _.forEach(path, step => {
            let pos = new RoomPosition(step.x, step.y, start.pos.roomName);
            if (_.isEmpty(pos.lookFor(LOOK_CONSTRUCTION_SITES)) &&
                    _.isEmpty(_.filter(pos.lookFor(LOOK_STRUCTURES),
                            s => s.structureType === STRUCTURE_ROAD))) {
                pos.createConstructionSite(STRUCTURE_ROAD);
            }
        });

        Memory.rooms[start.pos.roomName].paths[memoryKey] = true;

        if (start.pos.roomName !== end.pos.roomName) {
            // Points are in different rooms, findPathTo() only goes to the room border.
            // In order to complete the road the other half needs to be built as well.
            this.buildRoad(end, start);
        }
    },

    /**
     * Builds extensions around the given spawn in a checkerboard formation.
     *
     * @param {StructureSpawn} spawn The spawn that will stay in the middle of the extensions
     * @param {int} limit Maximum amount of extensions to build. If omitted, construction
     * sites will be added until the room limit is reached
     */
    buildExtensionsAroundSpawn: function (spawn, limit = -1) {
        var missingExtensionCount = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][spawn.room.controller.level] -
                utils.countStructures(spawn.room, STRUCTURE_EXTENSION, true);

        if (missingExtensionCount < 1) {
            return;
        }

        for (let range = 2; range < 7; range++) {
            for (let dx = -range; dx <= range; dx += 2) {
                for (let dy = -range; dy <= range; dy += 2) {
                    if (missingExtensionCount === 0 || limit === 0) {
                        // Limit hit, stop adding sites
                        return;
                    }

                    if (Math.abs(dx) !== range && Math.abs(dy) !== range) {
                        // Not a checkerboard position
                        continue;
                    }

                    let pos = spawn.room.getPositionAt(spawn.pos.x + dx, spawn.pos.y + dy);
                    if (pos.createConstructionSite(STRUCTURE_EXTENSION) === OK) {
                        spawn.room.log(`Built extension near spawn ${spawn.name} at (${pos.x}, ${pos.y})`);
                        missingExtensionCount--;
                        limit--;
                    }
                }
            }
        }
    },

    /**
     * Returns the spawn in the given room with the most free space around it. Free space
     * means a square with no structures, construction sites or walls in it.
     *
     * @param {Room} room The room whose spawns to check
     * @param {int} range The size of the area around the spawns to check
     * @return {null|StructureSpawn} The spawn with the most free space, or null if there
     * are no spawns in the room
     */
    getSpawnWithMostFreeSpace: function (room, range = 6) {
        let spawns = room.find(FIND_MY_SPAWNS);

        if (spawns.length === 1) {
            return spawns[0];
        } else if (spawns.length > 1) {
            let spawn = null;
            let maxFreeSpace;

            _.forEach(spawns, s => {
                if (spawn === null) {
                    spawn = s;
                    maxFreeSpace = this.countBuildableSquaresAroundPoint(s.pos, range);
                } else {
                    let freeSpace = this.countBuildableSquaresAroundPoint(s.pos, range);
                    if (freeSpace > maxFreeSpace) {
                        spawn = s;
                        maxFreeSpace = freeSpace;
                    }
                }
            });

            return spawn;
        }

        return null;
    },

    /**
     * Counts the squares around the given position that can be built on.
     *
     * @param {RoomPosition} pos The position to use as the center of the area
     * @param {int} range The radius of the square area to scan
     * @returns {number}
     */
    countBuildableSquaresAroundPoint: function (pos, range) {
        var buildableSquares = 0;

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                let x = pos.x + dx, y = pos.y + dy;
                if (x >= 0 && y >= 0 && x < 50 && y < 50 &&
                        new RoomPosition(x, y, pos.roomName).canBeBuiltOn()) {
                    buildableSquares++;
                }
            }
        }

        return buildableSquares;
    }
};