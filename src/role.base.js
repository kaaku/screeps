function BaseRole() {
}

BaseRole.prototype.run = function (creep) {
};

BaseRole.prototype.getBody = function (energy) {
    return [];
};

BaseRole.prototype.getMinCost = function () {
    return null;
};

BaseRole.prototype.getMaxCost = function () {
    return null;
};

module.exports = BaseRole;