// 7.3 kB
// 6.7 kB
// 6.4 kB
// 6.3 kB
// 5.6 kB

// TODO: properties-navn tar faktisk veldig mye av minifisert kode. Kan de være kortere?

const Raw = (function () {
    const Raw = {};

// 2.1 kB
// 1.8 kB

function repeatFlipped(f, t) {
    const abs = Math.abs(t)
    const abs2 = abs % 2;

    let flipT = t < 0;

    let flipV = flipT 
        ? abs2 < 1 
        : abs2 >= 1;
        
    t = abs % 1;

    const v = f(flipT ? 1 - t : t);
    return flipV ? 1 - v : v;
}

function triangleWave(t) {
    t = Math.abs(t/2);
    const n = t % 1.0;
    return n < 0.5 ? n * 2 : (1 - n) * 2;
}

function sineWave(t) {
    const n = t*Math.PI - Math.PI/2;
    return 0.5 + Math.sin(n) * 0.5;
}

function cosineWave(t) {
    return sineWave(t - Math.PI/2);
}

function easeInWave(t) {
    const f = (t) => {
        const n = t == 1.0 ? 1.0 : (t % 1.0);
        return n * n;
    }
    return repeatFlipped(f, t);
}

function easeOutWave(t) {
    const f = (t) => {
        const n = t == 1.0 ? 1.0 : (t % 1.0);
        return 1 - (1 - n) * (1 - n);
    }
    return repeatFlipped(f, t);
}

function easeOutCubicWave(t) {
    const f = (t) => {
        const u = 1 - t;
        return 1 - u * u * u;
    }
    return repeatFlipped(f, t);
}

function easeOutExpWave(t) {
    const strength = 1;
    const f = (t) => Math.pow(0.5, -(8 * strength * (t - 1)));
    return repeatFlipped(f, t);
}

// Denne er suuuupernærme sineWave. Men den er vel mye raskere enn Math.sin?
function easeInOutWave(t) {
    const f = (t) => t * t * (3 - 2 * t);
    return repeatFlipped(f, t);
}

const lerp = (a, b, t) => a + (b - a) * t;

function clamp(value, from, to) {
    let min = from;
    let max = to;
    
    if (to < from) {
        min = to;
        max = from;
    }

    return value < min ? min : value > max ? max : value;
}

function map(value, inMin, inMax, outMin, outMax, clampValue = false) {
    const t = (value - inMin) / (inMax - inMin);
    const mapped = outMin + (outMax - outMin) * t;
    return clampValue ? clamp(mapped, outMin, outMax) : mapped;
}

const length = (vector) => Math.sqrt(vector.x * vector.x + vector.y * vector.y);

const distance = (A, B) => length({x: B.x - A.x, y: B.y - A.y});

const angle = (A, B) => Math.atan2(B.y - A.y, B.x - A.x);

function normalize(vector) {
    const len = length(vector);
    return len === 0 ? {x: 0, y: 0} : {x: vector.x / len, y: vector.y / len};
}

const copy = (vec) => ({x: vec.x, y: vec.y});

const scale = (vector, scalar) => ({x: vector.x * scalar, y: vector.y * scalar});

const add =      (A, B) => ({x: A.x + B.x, y: A.y + B.y});
const subtract = (A, B) => ({x: A.x - B.x, y: A.y - B.y});

const fromTo = (from, to) => subtract(to, from);

const random = (from, to) => from + Math.random() * (to - from);
const randomInt = (from, to) => Math.floor(random(from, to + 1));

const lerpVectors = (A, B, t) => ({
    x: lerp(A.x, B.x, t),
    y: lerp(A.y, B.y, t)
});

// TODO: Vurder å standardisere på at funksjoner som tar inn w og h tar inn vektor i stedet
// TODO: Fjern denne metodesignaturen og bruk bare Raw.grid()
function gridDistribution(w, h = null) {
    if (h == null) { // Put w elements in a square
        w = Math.ceil(Math.sqrt(w));
        h = w;
    }
    const dimensions = {x: w, y: h};

    const maxIndex = {
        x: w === 1 ? 1 : w - 1,
        y: h === 1 ? 1 : h - 1,
    };
    const points = [];
    for (let i = 0; i < w*h; i++) {
        const index = {x: i % w, y: Math.floor(i / w)}
        const x = index.x / maxIndex.x;
        const y = index.y / maxIndex.y;
        const centeredIndex = subtract(index, scale(subtract(dimensions, {x: 1, y: 1}), 1/2));
        const centered = {x: lerp(-1, 1, x), y: lerp(-1, 1, y), index: centeredIndex};
        const size = {x: 1/dimensions.x, y: 1/dimensions.y};
        const topLeft = {x: x * (1 - 1/dimensions.x), y: y * (1 - 1/dimensions.y)};
        points.push({x, y, index, topLeft, size, centered});
    }
    return points;
}

const grid = (dimensions) => gridDistribution(dimensions.x, dimensions.y);

function pretty(vector, decimals = 2, length = 4) {
    const p = (n) => String(n.toFixed(decimals)).padStart(length, " ");
    return p(vector.x) + "," + p(vector.y);
}

const remove = (array, element) => array.splice(array.indexOf(element), 1);
// 3.4 kB
// 3.3 kB

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
// 0.6 kB

function timer({lengthSeconds = 2147483, onStart = () => {}, onEnd = () => {}} = {}) {
    let lastRunMillis, startedAtMillis, id;
    let counter = 0;
    let remainingSeconds = lengthSeconds;

    function onEndWrapper() {
        counter++;
        id = undefined;
        onEnd();
    }

    function run() {
        lastRunMillis = performance.now();
        id = setTimeout(onEndWrapper, remainingSeconds * 1000);
    }

    return {
        start() {
            onStart();
            startedAtMillis = performance.now();
            run(); 
        },
        pause() {
            id = clearTimeout(id);
            remainingSeconds -= (performance.now() - lastRunMillis) / 1000;
        },
        end() { 
            this.reset();
            onEndWrapper(); 
        },
        resume() { run(); },
        reset() { 
            id = clearTimeout(id); 
            counter = 0;
            remainingSeconds = lengthSeconds;
        },
        setLength(newLengthSeconds) {
            id = clearTimeout(id);
            lengthSeconds = newLengthSeconds;
            remainingSeconds = lengthSeconds;
        },
        restart() {
            id = clearTimeout(id);
            remainingSeconds = lengthSeconds;
            this.start();
        },
        // TODO: Kalle denne phase, og så la den være 0 før det starter, og så øke til 1 ved start. Da blir det mer sekvensielle faser
        // ELLER, kall den step?
        counter() { return counter; }, 
        value() { // TODO: value fortsetter å gå når man pauser
            const relativeAge = (performance.now() - startedAtMillis) / lengthSeconds / 1000;
            return clamp(relativeAge, 0, 1); 
        },
        running() { return !!id; },
        // TODO: Ha en phaseSeconds og en totalSeconds som er innenfor phase og totalt (gitt at timer får vite totalt antall phases)
        elapsedSeconds() {
            if (!startedAtMillis) return 0;
            return id 
                ? (performance.now() - startedAtMillis) / 1000 
                : lengthSeconds - remainingSeconds;
        },
    };
}

    /*
    TODO: Fra chatGPT:

    - Unngå å gjøre dette:
        add styles
        modify canvas size
        attach global listeners
        do not resize automatically (or makes it optional)
        Instead:
            ✔ require explicit canvas
            ✔ require explicit start
            ✔ document what you touch
     */

    Object.assign(Raw, {
        lerp, clamp, fromTo, map, distance, angle, copy, add, subtract, scale, normalize, random, randomInt, 
        grid, gridDistribution, pretty, traverse, triangleWave, easeInOutWave, easeInWave, easeOutWave, easeOutCubicWave, easeOutExpWave, sineWave, cosineWave, 
        timer,
        collision: Collision 
    })

    let canvas, ctx;
    let lastTimeMillis = performance.now();
    let frameCount = 0;
    
    Raw.fps = 0;
    let fpsMillis = performance.now();
    let fpsCounter = 0;

    let hoverNode = null;

    function traverse(node, callbackBefore, callbackAfter = () => {}) {
        callbackBefore(node);
        for (let child of node.children) {
            traverse(child, callbackBefore, callbackAfter);
        }
        callbackAfter(node);
    }

    function handleTargets(node) {
        for (let prop in node.target) {
            if (prop === "speed") continue;
            const lerpFunc = node[prop].x !== undefined ? lerpVectors : lerp;
            node[prop] = lerpFunc(node[prop], node.target[prop], node.target.speed);
        }
    }

    function measureFps(nowMillis) {
        const fpsDeltaMillis = nowMillis - fpsMillis;
        fpsCounter++;
        if (fpsDeltaMillis >= 100) { // update every x milliseconds
            Raw.fps = Math.round((fpsCounter / fpsDeltaMillis) * 1000);
            fpsCounter = 0;
            fpsMillis = nowMillis;
            if (Raw.fps < 20) console.warn("Low FPS:", Raw.fps);
        }
    }

    function drawDebug(node) {
        const origin = node.object.origin || {x: 0, y: 0};

        function cross(size, color) {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -size/2);
            ctx.lineTo(0, size/2);
            ctx.moveTo(-size/2, 0);
            ctx.lineTo(size/2, 0);
            ctx.stroke();
        }

        ctx.save();

        ctx.lineWidth = 1;
        ctx.translate(origin.x, origin.y);
        cross(20, "#ddd");

        const pivot = node.object.pivot;
        
        if (pivot) {
            ctx.translate(pivot.x, pivot.y);
            cross(20, "#f88");
        }

        if (node.id && node !== Raw.scenegraph) {
            ctx.font = (10 / Raw.camera.scale) + "px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2 / Raw.camera.scale;
            ctx.translate(4 / Raw.camera.scale, 4 / Raw.camera.scale); // Padding
            ctx.strokeText(node.id, 0, 0);
            ctx.fillStyle = 'white';
            ctx.fillText(node.id, 0, 0);
        }

        ctx.restore();
    }

    Raw.timeSeconds = 0;
    Raw.deltaSeconds = 0;
    Raw.mouse = {x: null, y: null};

    Raw.camera = {
        position: {x: 0, y: 0}, // TODO: Sett default til midt på canvas, i stedet for å alltid gjør offset i transform-funksjonen
        rotation: 0,
        zoom: 0, // -infinity (infinite zoomed out) ... 0 (no zoom) ... 0.99999 (infinite magnification)
        target: {speed: 0.05},
    };

    function updateCamera() {
        const c = Raw.camera;
        c.zoom = Math.min(c.zoom, 0.99999);
        c.scale = 1/(1 - c.zoom);

        Raw.topLeft = scale({x: -Raw.width/2, y: -Raw.height/2}, 1/c.scale);
        Raw.bottomRight = scale({x: Raw.width/2, y: Raw.height/2}, 1/c.scale);
    }

    Raw.scenegraph = {
        id: 'root',
        object: { // TODO: Rename til data, og bruk den kun for data, ikke funksjoner som transform
            update: function() {
                handleTargets(Raw.camera);
            },    
            transform: function(ctx, canvas) {
                const center = { // Dette setter koordinat (0,0) i scenen midt på canvas, som er praktisk
                    x: Raw.width/2,
                    y: Raw.height/2,
                }
                const translate = subtract(center, Raw.camera.position);

                updateCamera();

                // TODO: Dette blir ikke riktig når scale og translate gjøres sammen. Må nok bruke pivot riktig slik som i scenegraph ellers
                ctx.translate(translate.x, translate.y);
                ctx.rotate(Raw.camera.rotation);
                ctx.scale(Raw.camera.scale, Raw.camera.scale);
            },
        },
        // TODO: Origin burde jo også ligge her. Og det er jo dumt at så mange interne verdier ligger på object.
        // TODO: Kanskje hvis man ikke oppgir origin, men har hitbox, så kan origin settes til midten av hitbox automatisk
        position: {x: 0, y: 0},
        rotation: 0,
        scale: {x: 1, y: 1},
        target: {speed: 0.05},
        visible: true,
        children: [],
        add: function(object = {}, parent = this) {
            const node = {
                id: object.id || Math.random().toString(36).substring(2, 9),
                object: object,
                position: {x: 0, y: 0},
                rotation: 0,
                scale: {x: 1, y: 1},
                target: {speed: 0.05},
                visible: true,
                parent: parent,
                children: [],
                add: this.add,
                remove: function() {
                    object.collisionNode && object.collisionNode.remove();
                    remove(parent.children, this);
                }
            };

            if (object.hitbox) {
                const oncollision = object.oncollision ? object.oncollision.bind(node) : null;

                object.collisionNode = Array.isArray(object.hitbox) 
                    ? Raw.collision.addBody({...node, ...object, points: object.hitbox, oncollision}) 
                    : Raw.collision.addPoint({...node, ...object, ...object.hitbox, oncollision});
            }

            parent.children.push(node);

            return node;
        }
    };

    Raw.settings = {
        debug: false,
        clearOnFrame: true,
        clearColor: null, // null betyr transparent vha clearRect, ikke fillRect
        pause: false,
    };

    Raw.onFrame = function() {
        const nowMillis = performance.now();
        Raw.deltaSeconds = Raw.settings.pause ? 0 : (nowMillis - lastTimeMillis) / 1000;
        if (Raw.deltaSeconds > 0.1) Raw.deltaSeconds = 1/60; // Unngår altfor store hopp når andre faner vises
        lastTimeMillis = nowMillis;
        Raw.timeSeconds += Raw.deltaSeconds;
        
        measureFps(nowMillis);

        if (Raw.settings.clearOnFrame) {
            if (Raw.settings.clearColor === null) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = Raw.settings.clearColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        // TODO: For ytelse of cachebarhet, lag en lineær liste med ting som skal tegnes hver frame, 
        // sammen med den globale transjormasjonen som de skal ha, i stedet for å gjøre transformasjonen 
        // og tegningen i den rekursive traverseringen
        traverse(
            Raw.scenegraph, 
            (node) => {
                const obj = node.object;

                if (obj) {
                    if (obj.update) obj.update.call(node);

                    handleTargets(node);

                    ctx.save();

                    // Translate → Rotate → Scale

                    // 1. Move object to world position
                    ctx.translate(node.position.x, node.position.y)

                    // 2. Move to pivot
                    obj.pivot && ctx.translate(obj.pivot.x, obj.pivot.y);

                    // 3. Local transforms
                    ctx.rotate(node.rotation);
                    ctx.scale(node.scale.x, node.scale.y);

                    // 4. Move pivot back
                    obj.pivot && ctx.translate(-obj.pivot.x, -obj.pivot.y);

                    // 5. Draw with original coordinates
                    //drawNormally(ctx);

                    if (obj.transform) {
                        obj.transform.call(node, ctx, canvas);
                    }

                    const matrix = ctx.getTransform();

                    if (obj.collisionNode) {
                        const globalPosition = scale(matrix.transformPoint(node.object.position), 1/window.devicePixelRatio);
                        obj.collisionNode.position = copy(globalPosition)
                        obj.collisionNode.rotation = node.rotation;
                    }

                    // X. Move to draw origin:
                    // TODO: Bør dette hete draw origin, siden det ikke faktisk flytter children?
                    obj.origin && ctx.translate(-obj.origin.x, -obj.origin.y);

                    if (obj && obj.draw) {
                        obj.draw.call(node, ctx, canvas);
                    }
                    if (Raw.settings.debug) {
                        drawDebug(node);
                    }
                }
            },
            (node) => {
                const obj = node.object;
                ctx.restore();
            }
        );


        Raw.collision.update();

        if (Raw.settings.debug) {
            Raw.collision.draw(ctx, canvas);
        }

        frameCount++;
    };

    // TODO: Skal sånne ting være en funksjon på noden heller? Gjelder flere ting som f.eks. Raw.startDrag
    Raw.bringToFront = (node) => {
        remove(node.parent.children, node);
        node.parent.children.push(node);
    };

    Raw.bringToBack = (node) => {
        remove(node.parent.children, node);
        node.parent.children.unshift(node);
    };

    // TODO: Bruk lambda i disse tilfellene for å spare 6 bokstaver
    Raw.resize = function(width = canvas.parentElement.clientWidth, height = canvas.parentElement.clientHeight) {
        const ratio = window.devicePixelRatio || 1;

        console.log("Resizing:", width, height, ratio);

        canvas.height = height * ratio;
        canvas.width = width * ratio;

        // TODO: Dette burde være en vector med navn dimensions eller size, slik at man kan bruke vektor-matte:
        Raw.width = width;
        Raw.height = height;

        ctx.reset();
        ctx.scale(ratio, ratio);

        updateCamera();
    };

    function setMouseFromEvent(event) {
        const position = {
            x: event.offsetX || event.touches[0] && event.touches[0].clientX,
            y: event.offsetY || event.touches[0] && event.touches[0].clientY
        };

        // TODO: Rename til Raw.pointer
        Raw.mouse.x = position.x - Raw.width / 2;
        Raw.mouse.y = position.y - Raw.height / 2;

        const mouse = {type: "point", position, radius: 0};
        mouse.bbox = Raw.makebbox(mouse);

        hoverNode = null;

        Raw.traverse(Raw.scenegraph, node => {
            if (node.object.collisionNode) {
                node.bbox = Raw.makebbox(node.object.collisionNode);
                if (Collision.checkOverlap(mouse, node.object.collisionNode)) {
                    hoverNode = node;
                }
            }
        });
    }
    
    function onMouseDown(e) {
        const isPrimaryClick =
            e.button === 0 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey &&
            !e.altKey;

        if (!isPrimaryClick) return;

        setMouseFromEvent(e);
        Raw.mouse.down = true;

        if (Raw.settings.debug) console.log("Mouse down:", Raw.mouse.x, Raw.mouse.y, hoverNode && hoverNode.id);

        // TODO: Rename onmousedown på noden til onpointerdown osv for alle eventer
        if (hoverNode && hoverNode.object.onmousedown) {
            hoverNode.object.onmousedown.call(hoverNode, e);
        }
    }

    function onMouseUp(e) {
        setMouseFromEvent(e);
        Raw.mouse.down = false;

        if (hoverNode && hoverNode.object.onmouseup) {
            hoverNode.object.onmouseup.call(hoverNode, e);
        }        

        dragUp(e);
    }

    function onMouseMove(e) {
        setMouseFromEvent(e);

        if (hoverNode && hoverNode.object.onmousemove) {
            hoverNode.object.onmousemove.call(hoverNode, e);
        }        

        dragMove(e);
    }

    const drag = {
        active: false,
        pointerId: null,
        target: null,
        offset: {x: 0, y: 0},
    };

    Raw.startDrag = function(target, e) {
        drag.active = true;
        drag.target = target;

        dragDown(e);
    }

    function dragDown(e) {
        canvas.setPointerCapture(e.pointerId);

        const pos = {
            x: e.clientX,
            y: e.clientY,
        };
        
        drag.pointerId = e.pointerId;
        
        drag.offset = subtract(pos, drag.target);
    }

    function dragMove(e) {
        if (!drag.active || e.pointerId !== drag.pointerId) return;

        // Disse må være in place, fordi target er ekstern verdi som kan være pekt til andre steder
        drag.target.x = e.clientX - drag.offset.x;
        drag.target.y = e.clientY - drag.offset.y;
    }

    function dragUp(e) {
        if (e.pointerId !== drag.pointerId) return;

        drag.active = false;
        drag.pointerId = null;
        drag.target = null;
    }

    Raw.init = function(canvasElement) {
        canvas = canvasElement;

        // TODO: Rename alle disse til pointerXX
        const el = canvas.addEventListener;
        el("pointerdown", onMouseDown);
        el("pointerup", onMouseUp);
        el("pointermove", onMouseMove);
        el('pointercancel', dragUp);
        el('lostpointercapture', dragUp);
        el("resize", () => Raw.resize());

        const s = canvas.style;
        s.width = "inherit"; // To fill parent
        s.height = "inherit";
        s.display = "block"; // To not be inline
        // For dragging:
        s.touchAction = "none";
        s.userSelect = "none";

        el('touchmove', e => e.preventDefault(), { passive: false });

        ctx = canvas.getContext("2d");

        Raw.resize();
    }

    return Raw;
})();