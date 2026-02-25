const Collision = {}; 

(function () {
    const nodes = [];
    Collision.nodes = nodes;

    let previousCollisions = {};

    function addNode(properties) {
        const node = {...properties};
        node.remove = () => nodes.splice(nodes.indexOf(node), 1);
        nodes.push(node);
        return node;
    }

    // TODO: Burde kanskje hete Circle, Ball eller Disk elns, siden den har radius?
    Collision.addPoint = function(point) {
        return addNode({...point,
            type: "point",
            group: point.group || 0,
            affectedByGroups: point.affectedByGroups || [0],
            radius: point.radius || 0,
        });
    };

    Collision.addBody = function(body) {
        return addNode({...body,
            type: "body",
            group: body.group || 0,
            affectedByGroups: body.affectedByGroups || [0],
            points: body.points || [],
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
                    const nextPoint = node.points[(pointIndex + 1) % node.points.length];
                    ctx.beginPath();
                    ctx.moveTo(point.transformed.x, point.transformed.y);
                    ctx.lineTo(nextPoint.transformed.x, nextPoint.transformed.y);
                    ctx.stroke();
                });
            }
        });
    }

    function segmentsIntersect(p1, p2, p3, p4) {
        const d1 = direction(p3, p4, p1);
        const d2 = direction(p3, p4, p2);
        const d3 = direction(p1, p2, p3);
        const d4 = direction(p1, p2, p4);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        // Colinear cases
        if (d1 === 0 && onSegment(p3, p4, p1)) return true;
        if (d2 === 0 && onSegment(p3, p4, p2)) return true;
        if (d3 === 0 && onSegment(p1, p2, p3)) return true;
        if (d4 === 0 && onSegment(p1, p2, p4)) return true;

        return false;
    }

    function direction(a, b, c) {
        return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
    }

    function onSegment(a, b, p) {
        return (
            Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
            Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
        );
    }

    function pointInPolygon(point, polygon) {
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect =
                ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    }

    function distancePointToSegmentSquared(px, py, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;

        if (dx === 0 && dy === 0) {
            // a == b
            const dxp = px - a.x;
            const dyp = py - a.y;
            return dxp * dxp + dyp * dyp;
        }

        // Project point onto segment, clamp to [0,1]
        const t =
            ((px - a.x) * dx + (py - a.y) * dy) /
            (dx * dx + dy * dy);

        const clamped = Math.max(0, Math.min(1, t));

        const closestX = a.x + clamped * dx;
        const closestY = a.y + clamped * dy;

        const ddx = px - closestX;
        const ddy = py - closestY;

        return ddx * ddx + ddy * ddy;
    }

    function bboxBody(poly) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of poly) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { minX, minY, maxX, maxY };
    }

    function bboxCircle(circle) {
        const { position: { x: cx, y: cy }, radius: r } = circle;
        return {
            minX: cx - r,
            minY: cy - r,
            maxX: cx + r,
            maxY: cy + r
        };
    }

    function makebbox(node) {
        return node.type === "point" ? bboxCircle(node) : bboxBody(node.points.map(p => p.transformed));
    }

    Raw.makebbox = makebbox; // TODO: Putt bbox-greiene i util elns

    function bboxOverlap(a, b) {
        return !(
            a.maxX < b.minX ||
            a.minX > b.maxX ||
            a.maxY < b.minY ||
            a.minY > b.maxY
        );
    }

    function polygonsOverlap(polyA, polyB) {
        // 1. Edge intersection test
        for (let i = 0; i < polyA.length; i++) {
            const a1 = polyA[i];
            const a2 = polyA[(i + 1) % polyA.length];

            for (let j = 0; j < polyB.length; j++) {
                const b1 = polyB[j];
                const b2 = polyB[(j + 1) % polyB.length];

                if (segmentsIntersect(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }

        // 2. Containment test
        if (pointInPolygon(polyA[0], polyB)) return true;
        if (pointInPolygon(polyB[0], polyA)) return true;

        return false;
    }

    function circlePolygonOverlap(circle, polygon) {
        const { position: { x: cx, y: cy }, radius: r } = circle;
        const r2 = r * r;

        // 1. Center inside polygon → overlap
        if (pointInPolygon({ x: cx, y: cy }, polygon)) {
            return true;
        }

        // 2. Edge distance test
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];

            if (distancePointToSegmentSquared(cx, cy, a, b) <= r2) {
                return true;
            }
        }

        return false;
    }

    function circlesOverlap(circleA, circleB) {
        const distance = Raw.distance(circleA.position, circleB.position);
        const totalRadius = circleA.radius + circleB.radius;
        return distance <= totalRadius;
    }

    Collision.checkOverlap = function(nodeA, nodeB) {
        if (!bboxOverlap(nodeA.bbox, nodeB.bbox)) return false;
        
        // TODO: Hvis en node er axis aligned box bør beregningene forenkles veldig

        if (nodeA.type === "point" && nodeB.type === "point") {
            return circlesOverlap(nodeA, nodeB);
        } else if (nodeA.type === "body" && nodeB.type === "body") {
            return polygonsOverlap(
                nodeA.points.map(p => p.transformed), 
                nodeB.points.map(p => p.transformed), 
            );
        } else if (nodeA.type === "point" && nodeB.type === "body" || nodeA.type === "body" && nodeB.type === "point") {
            const pointNode = nodeA.type === "point" ? nodeA : nodeB;
            const otherBody = nodeA.type === "body" ? nodeA : nodeB;
            
            return circlePolygonOverlap(
                pointNode, 
                otherBody.points.map(p => p.transformed), 
            );
        }
    }

    Collision.update = function() {
        const collisions = {}; 

        nodes.forEach(node => {
            if (node.type === "body") {
                node.points.forEach(point => {
                    // TODO: Dette fungerer ikke for bodies som er lenger inni andre objekter i scenegraph
                    const radians = node.rotation || 0;
                    const sin = Math.sin(radians);
                    const cos = Math.cos(radians);
                    
                    const center = node.origin ? node.origin : {x: 0, y: 0};
                    const translated = subtract({x: point.x, y: point.y}, center);
                    
                    const rotated = {
                        x: translated.x * cos - translated.y * sin,
                        y: translated.x * sin + translated.y * cos
                    };
                    
                    point.transformed = add(add(rotated, center), node.position);
                });
            }

            node.bbox = makebbox(node);
        });

        nodes.forEach(node => {
            node.affectedByGroups.forEach(group => {
                // TODO: Lag et hashmap for grupper
                const affectedByNodes = nodes.filter(n => n.group === group);

                affectedByNodes.forEach(affectedByNode => {
                    if (affectedByNode === node) return; // Don't check collision with self
                    
                    if (Collision.checkOverlap(node, affectedByNode)) {
                        collisions[node.id] = affectedByNode.id;
                    }
                });
            });
        });

        // For each collision that is not in previousCollisions, call oncollision "in"
        Object.keys(collisions).forEach(nodeId => {
            const otherNodeId = collisions[nodeId];
            if (previousCollisions[nodeId] !== otherNodeId) {
                const node = nodes.find(n => n.id === nodeId);
                const otherNode = nodes.find(n => n.id === otherNodeId);
                node.oncollision && node.oncollision(otherNode, "in");
            }
        });

        // For each collision that is in previousCollisions but not in collisions, call oncollision "out"
        Object.keys(previousCollisions).forEach(nodeId => {
            const otherNodeId = previousCollisions[nodeId];
            if (collisions[nodeId] !== otherNodeId) {
                const node = nodes.find(n => n.id === nodeId);
                const otherNode = nodes.find(n => n.id === otherNodeId);
                node.oncollision && node.oncollision(otherNode, "out");
            }
        });

        previousCollisions = collisions;
    };
})();