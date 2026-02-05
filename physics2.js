const Physics2 = {}; 

// TODO: DEPRECATED: Alt i denne ble vel flyttet inn i Physics.js, og denne kan fjernes?

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

function velocityTrade(body, otherBody) {
    // Switch velocity with otherBody
    const tempVx = body.velocity.x;
    const tempVy = body.velocity.y;
    const dampFactor = 1 - Physics2.settings.collisionDamping;
    body.velocity.x = otherBody.velocity.x * dampFactor;
    body.velocity.y = otherBody.velocity.y * dampFactor;
    otherBody.velocity.x = tempVx * dampFactor;
    otherBody.velocity.y = tempVy * dampFactor;
    
    if (body.rotationVelocity && otherBody.rotationVelocity)  {
        // Switch negative rotation with otherBody
        const tempRv = body.rotationVelocity;
        const dampFactor = 1 - Physics2.settings.collisionDamping;
        body.rotationVelocity = -otherBody.rotationVelocity * dampFactor;
        otherBody.rotationVelocity = -tempRv * dampFactor;
    }
}

function pivotalVelocityTrade(body, otherBody, collisionPoint) {
    const A = copy(body.position);
    const C = copy(collisionPoint);
    const B = copy(otherBody.position);

    const vA = copy(body.velocity);
    const vB = copy(otherBody.velocity);

    const omegaA = body.rotationVelocity; // radians per second
    const omegaB = otherBody.rotationVelocity;

    console.log("Physics:", "A.id", body.id, "B.id", otherBody.id, "A", A, "B", B, "C", C, "vA", vA, "vB", vB, "omegaA", omegaA, "omegaB", omegaB);
    p.A = A; p.C = C; p.B = B; p.vA = vA; p.vB = vB; p.omegaA = omegaA; p.omegaB = omegaB;

    const OA = angularVelocityToVector(omegaA, A, C, 1);
    const OB = angularVelocityToVector(omegaB, B, C, 1);

    const WA = {
        x: vA.x + OA.x,
        y: vA.y + OA.y
    };
    const WB = {
        x: vB.x + OB.x,
        y: vB.y + OB.y
    };

    const CWB = {
        x: C.x + WB.x,
        y: C.y + WB.y
    };

    const CWA = {
        x: C.x + WA.x,
        y: C.y + WA.y
    };

    const projectedOnA = projectPointOntoLine(CWB, C, A);
    const projectedOnB = projectPointOntoLine(CWA, C, B);

    // TODO: delta er vel feil navn, da det er ny fart som erstatter gammel fart
    const vAdelta = {
        x: projectedOnA.x - C.x,
        y: projectedOnA.y - C.y
    };

    const OAdelta = {
        x: -(projectedOnA.x - CWB.x),
        y: -(projectedOnA.y - CWB.y)
    };

    const omegaAdelta = vectorToAngularVelocity(OAdelta, A, C);

    const vBdelta = {
        x: projectedOnB.x - C.x,
        y: projectedOnB.y - C.y
    };

    const OBdelta = {
        x: -(projectedOnB.x - CWA.x),
        y: -(projectedOnB.y - CWA.y)
    };

    const omegaBdelta = vectorToAngularVelocity(OBdelta, B, C);

    console.log("Physics result:", "omegaAdelta", omegaAdelta, "omegaBdelta", omegaBdelta, "vAdelta", vAdelta, "vBdelta", vBdelta);

    const dampingFactor = 1 - Physics2.settings.collisionDamping;

    body.rotationVelocity = omegaAdelta * dampingFactor;
    otherBody.rotationVelocity = omegaBdelta * dampingFactor;

    body.velocity.x = vAdelta.x * dampingFactor;
    body.velocity.y = vAdelta.y * dampingFactor;

    otherBody.velocity.x = vBdelta.x * dampingFactor;
    otherBody.velocity.y = vBdelta.y * dampingFactor;
    debugger;

    //Physics2.settings.doPhysics = false; // Pause physics for debugging
}

(function () {
    const bodies = [];
    Physics2.bodies = bodies;
    Physics2.settings = {
        doPhysics: false,
        drag: 1.1,
        gravity: {x: 0, y: 500},
        collisionDamping: 0.25,
    };

    Physics2.addBody = function(body) { // TODO: group = 0, affectedByGroups = [0, 1]
        Physics2.settings.doPhysics = true;

        body.points && body.points.forEach((point, index) => {
            point.oldPosition = {x: point.x, y: point.y};
        });
        body.oldPosition = {x: body.position.x, y: body.position.y};

        bodies.push({...body,
            points: body.points || [],
            position: body.position || {x: 0, y: 0},
            velocity: body.velocity || {x: 0, y: 0},
            acceleration: {x: 0, y: 0},
            rotationVelocity: body.rotationVelocity || 0.0,
            rotationAcceleration: 0,
            // TODO: beregn geometrisk senter som all rotasjon kommer til å være rundt:
            center: {x: 0, y: 0},
            closed: body.closed === undefined ? true : body.closed,
        });

        return bodies[bodies.length - 1];
    };

    Physics2.update = function(deltaSeconds) {
        if (!Physics2.settings.doPhysics) return;
        
        if (deltaSeconds > 0.1) deltaSeconds = 0.1; // Ikke bra med store hopp i fysikken
        
        bodies.forEach(body => {
            body.points.forEach(point => {
                // TODO: Egentlig burde alle points være i world space for å holde det enkelt
                // Eller er det egentlig enklere??
                point.oldPosition = {x: point.x, y: point.y};
            });
            body.oldPosition = {x: body.position.x, y: body.position.y};
        
            // Friction and gravity
            body.acceleration.x = Physics2.settings.gravity.x - body.velocity.x * Physics2.settings.drag;
            body.acceleration.y = Physics2.settings.gravity.y - body.velocity.y * Physics2.settings.drag;
            
            // Velocity and position
            body.velocity.x += body.acceleration.x * deltaSeconds;
            body.velocity.y += body.acceleration.y * deltaSeconds;

            body.position.x += body.velocity.x * deltaSeconds;
            body.position.y += body.velocity.y * deltaSeconds;

            // TODO: Gjør det samme med rotasjon. Kanskje lage noe generelt som gjør det for x, og så y og så rotation

            // Update rotationAcceleration according to rotationVelocity * angular drag

            // Update rotationVelocity according to rotationAcceleration and deltaSeconds

            // Rotate all body.points around body.center according to body.rotationVelocity
            body.points.forEach(point => {
                const radians = body.rotationVelocity * deltaSeconds;
                const sin = Math.sin(radians);
                const cos = Math.cos(radians);
                
                const translatedX = point.x - body.center.x;
                const translatedY = point.y - body.center.y;
                const rotatedX = translatedX * cos - translatedY * sin;
                const rotatedY = translatedX * sin + translatedY * cos;
                
                point.x = rotatedX + body.center.x;
                point.y = rotatedY + body.center.y;
            });

            // Check collisions with other bodies
            bodies.forEach(otherBody => {
                if (otherBody === body) return; // Don't check collision with self

                body.points.forEach((point, index) => {
                    const worldPoint = {
                        x: point.x + body.position.x,
                        y: point.y + body.position.y
                    };

                    otherBody.points.forEach((otherPoint, otherIndex) => {
                        if (otherBody.closed === false && otherIndex === otherBody.points.length - 1) return; // Skip last point if not closed
                        
                        const nextOtherIndex = (otherIndex + 1) % otherBody.points.length;
                        const nextOtherPoint = otherBody.points[nextOtherIndex];

                        const otherPointWorldPosition = {
                            x: otherPoint.x + otherBody.position.x,
                            y: otherPoint.y + otherBody.position.y
                        };

                        const nextOtherPointWorldPosition = {
                            x: nextOtherPoint.x + otherBody.position.x,
                            y: nextOtherPoint.y + otherBody.position.y
                        };

                        // TODO: En vectorAdd-metode er vel fint, og multiplyScalar
                        const oldWorldPoint = {x: body.oldPosition.x + point.oldPosition.x, y: body.oldPosition.y + point.oldPosition.y};
                        const oldOtherPointWorldPosition = {x: otherBody.oldPosition.x + otherPoint.oldPosition.x, y: otherBody.oldPosition.y + otherPoint.oldPosition.y};
                        const oldNextOtherPointWorldPosition = {x: otherBody.oldPosition.x + nextOtherPoint.oldPosition.x, y: otherBody.oldPosition.y + nextOtherPoint.oldPosition.y};

                        const oldProjection = projectPointOntoLine(oldWorldPoint, oldOtherPointWorldPosition, oldNextOtherPointWorldPosition);
                        const newProjection = projectPointOntoLine(worldPoint, otherPointWorldPosition, nextOtherPointWorldPosition);
                        const isCollision = Math.sign(oldProjection.side) !== Math.sign(newProjection.side) &&
                                             newProjection.param >= 0 && newProjection.param <= 1;
                        const direction = oldProjection.side < 0 ? "in" : "out";

                        if (isCollision && direction == "in") {
                            console.log("Collision", body.id + "." + point.id, "on", otherBody.id, "going", direction);
                            //debugger;

                            /*
                            // Move body and points back to old position
                            body.position.x = body.oldPosition.x;
                            body.position.y = body.oldPosition.y;

                            body.points.forEach(p => {
                                p.x = p.oldPosition.x;
                                p.y = p.oldPosition.y;
                            });
                            */

                            // Do collision response
                            //velocityTrade(body, otherBody);
                            pivotalVelocityTrade(body, otherBody, worldPoint);
                        }
                    });
                });
            });
        });
    };
})();