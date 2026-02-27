const Collision = {}; 

(function () {
    const nodes = [];
    Collision.nodes = nodes;

    let previousCollisions = {};

    function addNode(properties) {
        const node = {...properties};
        node.remove = () => remove(nodes, node);
        nodes.push(node);
        return node;
    }

    // TODO: Burde kanskje hete Circle, Ball eller Disk elns, siden den har radius?
    Collision.addPoint = function(point) {
        return addNode({...point,
            type: "point",
            group: point.group || 0,
            mask: point.mask || [0], // List of groups affecting this element
            radius: point.radius || 0,
        });
    };

    Collision.addBody = function(body) {
        return addNode({...body,
            type: "body",
            group: body.group || 0,
            mask: body.mask || [0],
            points: body.points || [],
        });
    };

    Collision.draw = function(ctx) {
        nodes.forEach(node => {
            ctx.strokeStyle = "#f88";
            ctx.lineWidth = 1;

            if (node.type === "point") {
                ctx.beginPath();
                ctx.arc(node.position.x, node.position.y, node.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (node.type === "body") {
                node.points.forEach((point, i) => {
                    const next = node.points[(i + 1) % node.points.length];
                    ctx.beginPath();
                    ctx.moveTo(point.global.x, point.global.y);
                    ctx.lineTo(next.global.x, next.global.y);
                    ctx.stroke();
                });
            }
        });
    }

    function segmentsIntersect(p1, p2, p3, p4) {
        function dir(a, b, c) {
            return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
        };

        function inside(a, b, p) {
            return (
                Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
                Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
            );
        }

        const d1 = dir(p3, p4, p1),
            d2 = dir(p3, p4, p2),
            d3 = dir(p1, p2, p3),
            d4 = dir(p1, p2, p4);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        // Colinear cases
        if (
            (d1 === 0 && inside(p3, p4, p1)) ||
            (d2 === 0 && inside(p3, p4, p2)) ||
            (d3 === 0 && inside(p1, p2, p3)) ||
            (d4 === 0 && inside(p1, p2, p4))
        ) return true;

        return false;
    }

    function pointInPolygon(p, poly) {
        let inside = false;

        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, 
                yi = poly[i].y,
                xj = poly[j].x, 
                yj = poly[j].y;

            const intersect =
                ((yi > p.y) !== (yj > p.y)) &&
                (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    }

    function distancePointToSegmentSquared(p, a, b) {
        const d = subtract(b, a);

        if (d.x === 0 && d.y === 0) {
            // a == b
            const dp = subtract(p, a);
            return dp.x * dp.x + dp.y * dp.y;
        }

        // Project point onto segment, clamp to [0,1]
        const t =
            ((p.x - a.x) * d.x + (p.y - a.y) * d.y) /
            (d.x * d.x + d.y * d.y);

        const clamped = Math.max(0, Math.min(1, t));

        const closest = { x: a.x + clamped * d.x, y: a.y + clamped * d.y };
        const dd = subtract(p, closest);

        return dd.x * dd.x + dd.y * dd.y;
    }

    function bboxBody(poly) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of poly) {
            x0 = Math.min(x0, p.x);
            y0 = Math.min(y0, p.y);
            x1 = Math.max(x1, p.x);
            y1 = Math.max(y1, p.y);
        }
        return { x0, y0, x1, y1 };
    }

    function bboxCircle(circle) {
        const { position: p, radius: r } = circle;
        return {
            x0: p.x - r,
            y0: p.y - r,
            x1: p.x + r,
            y1: p.y + r
        };
    }

    function makebbox(node) {
        return node.type === "point" ? bboxCircle(node) : bboxBody(node.points.map(p => p.global));
    }

    Raw.makebbox = makebbox; // TODO: Putt bbox-greiene i util elns

    function bboxOverlap(a, b) {
        return !(
            a.x1 < b.x0 ||
            a.x0 > b.x1 ||
            a.y1 < b.y0 ||
            a.y0 > b.y1
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
        if (pointInPolygon(polyA[0], polyB) || pointInPolygon(polyB[0], polyA)) return true;

        return false;
    }

    function circlePolygonOverlap(circle, poly) {
        const { position: p, radius: r } = circle;
        const r2 = r * r;

        // 1. Center inside polygon → overlap
        if (pointInPolygon(p, poly)) {
            return true;
        }

        // 2. Edge distance test
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];

            if (distancePointToSegmentSquared(p, a, b) <= r2) {
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

        const typeA = nodeA.type,
            typeB = nodeB.type;

        if (typeA === "point" && typeB === "point") {
            return circlesOverlap(nodeA, nodeB);
        } else if (typeA === "body" && typeB === "body") {
            return polygonsOverlap(
                nodeA.points.map(p => p.global), 
                nodeB.points.map(p => p.global), 
            );
        } else if (typeA === "point" && typeB === "body" || typeA === "body" && typeB === "point") {
            const point = typeA === "point" ? nodeA : nodeB;
            const body = typeA === "body" ? nodeA : nodeB;
            
            return circlePolygonOverlap(
                point, 
                body.points.map(p => p.global), 
            );
        }
    }

    Collision.update = function() {
        const collisions = {}; 

        nodes.forEach(node => {
            if (node.type === "body") {
                node.points.forEach(p => {
                    // TODO: Dette fungerer ikke for bodies som er lenger inni andre objekter i scenegraph
                    const center = node.origin ? node.origin : {x: 0, y: 0};
                    const translated = subtract(p, center);
                    
                    const sin = Math.sin(node.rotation),
                        cos = Math.cos(node.rotation);

                    const rotated = {
                        x: translated.x * cos - translated.y * sin,
                        y: translated.x * sin + translated.y * cos
                    };
                    
                    // TODO: Ser ikke ut til å ta hensyn til camera zoom
                    p.global = add(add(rotated, center), node.position);
                });
            }

            node.bbox = makebbox(node);
        });

        nodes.forEach(node => {
            node.mask.forEach(group => {
                // TODO: Lag et hashmap for grupper
                const affectedByNodes = nodes.filter(n => n.group === group);

                affectedByNodes.forEach(affectedByNode => {
                    if (affectedByNode === node) return; // Don't check collision with self
                    
                    if (Collision.checkOverlap(node, affectedByNode)) {
                        collisions[node.id] = collisions[node.id] || [];
                        collisions[node.id].push(affectedByNode.id);
                    }
                });
            });
        });

        // For each collision that is not in previousCollisions, call oncollision "in"
        for (const id in collisions) {
            for (const otherId of collisions[id]) {
                if (!previousCollisions[id] || !previousCollisions[id].includes(otherId)) {
                    const node = nodes.find(n => n.id === id);
                    const other = nodes.find(n => n.id === otherId);
                    node && other && node.oncollision && node.oncollision(other, "in");
                }
            }
        };

        // For each collision that is in previousCollisions but not in collisions, call oncollision "out"
        for (const id in previousCollisions) {
            for (const otherId of previousCollisions[id]) {
                if (!collisions[id] || !collisions[id].includes(otherId)) {
                    const node = nodes.find(n => n.id === id);
                    const other = nodes.find(n => n.id === otherId);
                    node && other && node.oncollision && node.oncollision(other, "out");
                }
            }
        };

        previousCollisions = collisions;
    };
})();