const Collision = {}; 

function angularVelocityToVector(omega, pointA, pointB) {
    const AB = {x: pointB.x - pointA.x, y: pointB.y - pointA.y};
    return {
        x: -omega * AB.y,
        y:  omega * AB.x
    };
}

// The inverse operation of angularVelocityToVector
function vectorToAngularVelocity(vector, pointA, pointB) {
    const radius = Raw.distance(pointA, pointB);
    if (radius == 0) return 0;
    const vectorLength = Raw.length(vector);
    const AB = {x: pointB.x - pointA.x, y: pointB.y - pointA.y};
    const cross = AB.x * vector.y - AB.y * vector.x;
    const direction = cross >= 0 ? 1 : -1;
    return vectorLength / radius * direction;
}

(function () {
    const nodes = [];
    Collision.nodes = nodes;
    const collisionCount = {};

    function getCollisionCount(body, otherBody) {
        return collisionCount[body.id + "-" + otherBody.id] || 0;
    }

    function setCollisionCount(body, otherBody, count) {
        if (count < 0) {
            console.error("Collision count cannot be", count, "for", body.id, "and", otherBody.id);
            return;
        }
        collisionCount[body.id + "-" + otherBody.id] = count;
        collisionCount[otherBody.id + "-" + body.id] = count;
    }

    function addNode(properties) {
        const node = {...properties};
        node.remove = () => nodes.splice(nodes.indexOf(node), 1);
        nodes.push(node);
        return node;
    }

    // Burde kanskje hete Ball eller Disk elns, siden den har radius?
    Collision.addPoint = function(point) {
        return addNode({...point,
            //oldPosition: {x: point.position.x, y: point.position.y},     
            group: 0, // TODO: parameter
            affectedByGroups: [0], // TODO: parameter
            type: "point",
        });
    };

    Collision.addBody = function(body) { // TODO: group = 0, affectedByGroups = [0, 1]
        return addNode({...body,
            type: "body",
            // TODO: Trenger et konsept om static: true som gjør at kun farten til den andre som kolliderer blir reflektert på flatenormalen 
            group: body.group || 0,
            affectedByGroups: body.affectedByGroups || [0],
            points: body.points || [],
            // TODO: beregn geometrisk senter som all rotasjon kommer til å være rundt:
            center: {x: 0, y: 0},
            closed: body.closed === undefined ? true : body.closed,
        });
    };

    Collision.draw = function(ctx, canvas) {
        nodes.forEach(node => {
            ctx.strokeStyle = "#f88";
            ctx.lineWidth = 1;

            if (node.type === "point") {
                ctx.beginPath();
                ctx.arc(node.position.x, node.position.y, node.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (node.type === "body") {
                node.points.forEach((point, pointIndex) => {
                    ctx.fillStyle = "#f88";
                    ctx.fillRect(node.position.x + point.x - 2, node.position.y + point.y -2, 4, 4);

                    if (node.closed || pointIndex < node.points.length - 1) {
                        const nextPoint = node.points[(pointIndex + 1) % node.points.length];
                        ctx.beginPath();
                        ctx.moveTo(node.position.x + point.x, node.position.y + point.y);
                        ctx.lineTo(node.position.x + nextPoint.x, node.position.y + nextPoint.y);
                        ctx.strokeStyle = "#f88";
                        ctx.stroke();
                    }
                });
            }
        });
    }

    Collision.update = function(deltaSeconds) {
        if (deltaSeconds > 0.1) deltaSeconds = 0.1; // Ikke bra med store hopp i fysikken
        
        nodes.forEach(node => {

            // Oppdater hastighet og posisjon
            //node.position = add(node.position, scale(node.velocity, deltaSeconds));

            if (node.type === "body") {
                // TODO: Gjør det samme med rotasjon. Kanskje lage noe generelt som gjør det for x, og så y og så rotation

                // TODO: Update rotationAcceleration according to rotationVelocity * angular drag

                // TODO: Update rotationVelocity according to rotationAcceleration and deltaSeconds?

                // Rotate all body.points around body.center according to body.rotationVelocity
                node.points.forEach(point => {
                    const radians = node.rotationVelocity * deltaSeconds;
                    const sin = Math.sin(radians);
                    const cos = Math.cos(radians);
                    
                    const translatedX = point.x - node.center.x;
                    const translatedY = point.y - node.center.y;
                    const rotatedX = translatedX * cos - translatedY * sin;
                    const rotatedY = translatedX * sin + translatedY * cos;
                    
                    //point.x = rotatedX + node.center.x;
                    //point.y = rotatedY + node.center.y;
                });
            }



            node.affectedByGroups.forEach(group => {
                // TODO: Lag et hashmap for grupper
                const affectedByNodes = nodes.filter(n => n.group === group);

                affectedByNodes.forEach(affectedByNode => {
                    // Don't check collision with self
                    if (affectedByNode === node) return;

                    // Don't check collision on any node's first frame 
                    // when it has not moved yet
                    if (!node.oldPosition ||!affectedByNode.oldPosition) return;

                    if (node.type === "point" && affectedByNode.type === "point") {

                        const diff = subtract(node.position, affectedByNode.position);
                        const distance = length(diff);

                        const oldDiff = subtract(node.oldPosition, affectedByNode.oldPosition);
                        const oldDistance = length(oldDiff);

                        const totalRadius = node.radius + affectedByNode.radius;

                        const inside = distance < totalRadius;
                        const wasInside = oldDistance < totalRadius;
                        const direction = (distance - oldDistance) > 0 ? "out" : "in";

                        if (inside !== wasInside) {
                            //console.log("Point collision", node.id, "on", affectedByNode.id, "going", direction);
                            if (node.oncollision) node.oncollision(affectedByNode, direction);
                            if (affectedByNode.oncollision) affectedByNode.oncollision(node, direction);
                            
                        }
                    } else if (node.type === "body" && affectedByNode.type === "body") {
                        const body = node;
                        const otherBody = affectedByNode;
                        body.points.forEach((point, index) => {
                            const worldPoint = add(body.position, point);

                            otherBody.points.forEach((otherPoint, otherIndex) => {
                                // TODO: Dette er DRY med body-body-collision over
                                if (otherBody.closed === false && otherIndex === otherBody.points.length - 1) return; // Skip last point if not closed
                                
                                const nextOtherIndex = (otherIndex + 1) % otherBody.points.length;
                                const nextOtherPoint = otherBody.points[nextOtherIndex];

                                const otherPointWorldPosition = add(otherBody.position, otherPoint);
                                const nextOtherPointWorldPosition = add(otherBody.position, nextOtherPoint);

                                const oldWorldPoint = add(body.oldPosition, point.oldPosition);
                                const oldOtherPointWorldPosition = add(otherBody.oldPosition, otherPoint.oldPosition);
                                const oldNextOtherPointWorldPosition = add(otherBody.oldPosition, nextOtherPoint.oldPosition);

                                const oldProjection = projectPointOntoLine(oldWorldPoint, oldOtherPointWorldPosition, oldNextOtherPointWorldPosition);
                                const newProjection = projectPointOntoLine(worldPoint, otherPointWorldPosition, nextOtherPointWorldPosition);
                                const isCollision = Math.sign(oldProjection.side) !== Math.sign(newProjection.side) &&
                                                    newProjection.param >= 0 && newProjection.param <= 1;
                                const direction = oldProjection.side < 0 ? "in" : "out";

                                if (isCollision) {
                                    const collisionCount = getCollisionCount(body, otherBody);
                                    const inc = direction == "in" ? 1 : -1;
                                    setCollisionCount(body, otherBody, collisionCount + inc);

                                    if (collisionCount === 0 && direction == "in" ||
                                        collisionCount === 1 && direction == "out") {
                                        if (body.oncollision) body.oncollision(otherBody, direction);
                                        if (otherBody.oncollision) otherBody.oncollision(body, direction);
                                        //console.log("Collision", body.id + "." + point.id, "on", otherBody.id, "going", direction);
                                    }
                                }
                            });
                        });
                    } else if (node.type === "point" && affectedByNode.type === "body" || node.type === "body" && affectedByNode.type === "point") {
                        const pointNode = node.type === "point" ? node : affectedByNode;
                        const otherBody = node.type === "body" ? node : affectedByNode;
                        
                        otherBody.points.forEach((otherPoint, otherIndex) => {
                            if (otherBody.closed === false && otherIndex === otherBody.points.length - 1) return; // Skip last point if not closed
                            
                            const nextOtherIndex = (otherIndex + 1) % otherBody.points.length;
                            const nextOtherPoint = otherBody.points[nextOtherIndex];

                            const otherPointWorldPosition = add(otherBody.position, otherPoint);
                            const nextOtherPointWorldPosition = add(otherBody.position, nextOtherPoint);

                            const worldPoint = pointNode.position;
                            const oldWorldPoint = pointNode.oldPosition;
                            const oldOtherPointWorldPosition = add(otherBody.oldPosition, otherPoint.oldPosition);
                            const oldNextOtherPointWorldPosition = add(otherBody.oldPosition, nextOtherPoint.oldPosition);

                            const oldProjection = projectPointOntoLine(oldWorldPoint, oldOtherPointWorldPosition, oldNextOtherPointWorldPosition);
                            const newProjection = projectPointOntoLine(worldPoint, otherPointWorldPosition, nextOtherPointWorldPosition);

                            const pointInside = distance(worldPoint, otherPointWorldPosition) < pointNode.radius ||
                                              distance(worldPoint, nextOtherPointWorldPosition) < pointNode.radius ||
                                              (newProjection.param >= 0 && newProjection.param <= 1 &&
                                               distance(worldPoint, newProjection) < pointNode.radius);

                            const oldPointInside = distance(oldWorldPoint, oldOtherPointWorldPosition) < pointNode.radius ||
                                                    distance(oldWorldPoint, oldNextOtherPointWorldPosition) < pointNode.radius ||
                                                    (oldProjection.param >= 0 && oldProjection.param <= 1 &&
                                                     distance(oldWorldPoint, oldProjection) < pointNode.radius);

                            const isCollision = pointInside !== oldPointInside;

                            const direction = pointInside === true && oldPointInside === false ? "in" : "out";

                            if (isCollision) {
                                const collisionCount = getCollisionCount(pointNode, otherBody);
                                const inc = direction == "in" ? 1 : -1;
                                setCollisionCount(pointNode, otherBody, collisionCount + inc);
                                if (collisionCount === 0 && direction == "in" ||
                                        collisionCount === 1 && direction == "out") {
                                    if (pointNode.oncollision) pointNode.oncollision(otherBody, direction);
                                    if (otherBody.oncollision) otherBody.oncollision(pointNode, direction);
                                    //console.log("Collision", pointNode.id, "on", otherBody.id, "going", direction);
                                    //debugger;
                                }
                            }
                        });
                    } else {
                        console.error("Collision not implemented for", node.type, "and", affectedByNode.type);
                    }
                });
            });
        });

        nodes.forEach(node => {
            // Lagre gammel posisjon for neste kollisjonsjekk
            node.oldPosition = {x: node.position.x, y: node.position.y};

            if (node.type === "body") {
                node.points.forEach(point => {
                    point.oldPosition = {x: point.x, y: point.y};
                });
            }
        });
    };
})();