// TODO: Disse blir jo liggende i globalt scope:
import { lerp, clamp, map, distance, length, normalize, triangleWave, sineWave, cosineWave, easeInWave, easeOutWave, easeOutCubicWave, easeInOutWave, random, randomInt } from "./util";
import { _ } from "./collision";

const Raw = {}; // TODO: Få bundleren til å lage slike namespaces og legge alt som er export inn der

(function () {
    let canvas, ctx;
    let lastTimeMillis = performance.now();
    let frameCount = 0;
    
    let fpsLastTimeMillis = performance.now();
    Raw.fps = 0;
    let fpsCounter = 0;

    function traverse(node, callbackBefore, callbackAfter = () => {}) {
        callbackBefore(node);
        for (let child of node.children) {
            traverse(child, callbackBefore, callbackAfter);
        }
        callbackAfter(node);
    }

    function measureFps(timeMillis) {
        const fpsDeltaMillis = timeMillis - fpsLastTimeMillis;
        fpsCounter++;
        if (fpsDeltaMillis >= 100) { // update every x milliseconds
            fps = (fpsCounter / fpsDeltaMillis) * 1000;
            Raw.fps = Math.round(fps);
            //console.log("FPS:", Raw.fps);
            fpsCounter = 0;
            fpsLastTimeMillis = timeMillis;
        }
    }

    function drawDebug(node) {
        const origin = node.object.origin || {x: 0, y: 0};

        ctx.save();

        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 1;

        ctx.strokeStyle = "#ddd";
        const size = 20;
        ctx.translate(origin.x, origin.y);
        ctx.beginPath();
        ctx.moveTo(0, -size/2);
        ctx.lineTo(0, size/2);
        ctx.moveTo(-size/2, 0);
        ctx.lineTo(size/2, 0);
        ctx.stroke();

        // TODO: Støtte polygon hitbox også, ikke bare lengde 2 (AABB)
        if (node.object.hitbox && node.object.hitbox.length === 2) {
            const hitbox = node.object.hitbox.map(corner => 
                node.object.origin ? subtract(corner, node.object.origin) : corner
            );

            ctx.strokeStyle = "#ddd";
            ctx.strokeRect(hitbox[0].x, hitbox[0].y, hitbox[1].x - hitbox[0].x, hitbox[1].y - hitbox[0].y);
        }
        
        if (node.object.pivot) {
            const pivot = node.object.pivot;

            ctx.strokeStyle = "#f88";
            ctx.translate(pivot.x, pivot.y);
            ctx.beginPath();
            ctx.moveTo(0, -size/2);
            ctx.lineTo(0, size/2);
            ctx.moveTo(-size/2, 0);
            ctx.lineTo(size/2, 0);
            ctx.stroke();
        }

        if (node.id && node !== Raw.scenegraph) {
            ctx.globalCompositeOperation = "source-over";
            ctx.font = "10px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            const padding = 4;
            ctx.strokeText(node.id, padding, padding);
            ctx.fillStyle = 'white';
            ctx.fillText(node.id, padding, padding);
        }

        ctx.restore();
    }

    Raw.timeSeconds = 0;
    Raw.deltaSeconds = 0;
    Raw.mouse = {x: null, y: null};

    Raw.traverse = traverse;

    Raw.triangleWave = triangleWave;
    Raw.easeInOutWave = easeInOutWave;
    Raw.easeInWave = easeInWave;
    Raw.easeOutWave = easeOutWave;
    Raw.easeOutCubicWave = easeOutCubicWave;
    Raw.sineWave = sineWave;
    Raw.cosineWave = cosineWave;
    Raw.lerp = lerp;
    Raw.clamp = clamp;
    Raw.fromTo = fromTo;
    Raw.map = map;
    Raw.distance = distance;
    Raw.length = length;
    Raw.scale = scale;
    Raw.normalize = normalize;
    Raw.random = random;
    Raw.randomInt = randomInt;
    Raw.bodyCenter = bodyCenter;

    Raw.gridDistribution = gridDistribution;
    
    Raw.collision = Collision;

    Raw.camera = {
        position: {x: 0, y: 0}, // TODO: Sett default til midt på canvas, i stedet for å alltid gjør offset i transform-funksjonen
        rotation: 0,
        zoom: 0, // -infinity (infinite zoomed out) ... 0 (no zoom) ... 0.99999 (infinite magnification)
        target: {speed: 0.05},
    };

    Raw.scenegraph = {
        id: 'root',
        object: { // TODO: Rename til data, og bruk den kun for data, ikke funksjoner som transform
            update: function() {
                if (Raw.camera.target.zoom !== undefined) {
                    Raw.camera.zoom = Raw.lerp(Raw.camera.zoom, Raw.camera.target.zoom, Raw.camera.target.speed);
                }
                if (Raw.camera.target.rotation !== undefined) {
                    Raw.camera.rotation = Raw.lerp(Raw.camera.rotation, Raw.camera.target.rotation, Raw.camera.target.speed);
                }
                if (Raw.camera.target.position !== undefined) {
                    // TODO: Bruk en vector-lerp her, og alle andre steder som ligner
                    Raw.camera.position.x = Raw.lerp(Raw.camera.position.x, Raw.camera.target.position.x, Raw.camera.target.speed);
                    Raw.camera.position.y = Raw.lerp(Raw.camera.position.y, Raw.camera.target.position.y, Raw.camera.target.speed);
                }
            },    
            transform: function(ctx, canvas) {
                const center = { // Dette setter koordinat (0,0) i scenen midt på canvas, som er praktisk
                    x: Raw.width/2,
                    y: Raw.height/2,
                }
                const translate = subtract(center, Raw.camera.position);

                Raw.camera.zoom = Math.min(Raw.camera.zoom, 0.99999);
                const scale = 1/(1 - Raw.camera.zoom);

                // TODO: Dette blir ikke riktig når scale og translate gjøres sammen. Må nok bruke pivot riktig slik som i scenegraph ellers
                ctx.translate(translate.x, translate.y);
                ctx.rotate(Raw.camera.rotation);
                ctx.scale(scale, scale);
            },
        },
        // TODO: Origin burde jo også ligge her. Og det er jo dumt at så mange interne verdier ligger på object.
        // TODO: Kanskje hvis man ikke oppgir origin, men har hitbox, så kan origin settes til midten av hitbox automatisk
        position: {x: 0, y: 0},
        rotation: 0,
        scale: {x: 1, y: 1},
        target: {speed: 0.05},
        children: [],
        add: function(object = {}, parent = this) {
            const node = {
                id: object.id || Math.random().toString(36).substring(2, 9),
                object: object,
                position: {x: 0, y: 0},
                rotation: 0,
                scale: {x: 1, y: 1},
                target: {speed: 0.05},
                parent: parent,
                children: [],
                add: this.add,
                remove: function() {
                    object.collisionNode && object.collisionNode.remove();
                    parent.children.splice(parent.children.indexOf(this), 1);
                }
            };

            // TODO: Hitbox bør kunne være enten
            // point med radius, AABB eller polygon
            if (object.hitbox) {
                const oncollision = object.oncollision ? object.oncollision.bind(node) : null;
                
                if (object.hitbox.length == 2) {
                    // Antar boundingbox med topleft of bottomright
                    // TODO: Dette gjør jo at man aldri kan ha en body med bare to punkter, som kan være nyttig for å lage en linje-grense
                    const hitboxWidth = (object.hitbox[1].x - object.hitbox[0].x);
                    object.collisionNode = Raw.collision.addPoint(
                        {id: node.id, position: {x:0, y:0}, radius: hitboxWidth/2, oncollision}
                    );
                } else {
                    // Antar liste med punkter for et polygon
                    object.collisionNode = Raw.collision.addBody(
                        {id: node.id, position: {x:0, y:0}, points: object.hitbox, oncollision}
                    );
                }
            }

            parent.children.push(node);

            return node;
        }
    };

    Raw.settings = {
        debug: false,
        clearOnFrame: true,
        clearColor: null, // null betyr transparent vha clearRect, ikke fillRect
    };

    Raw.timer = function({lengthSeconds = 2147483, onStart = () => {}, onEnd = () => {}} = {}) {
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
            counter() { return counter; },
            value() { // TODO: value fortsetter å gå når man pauser
                const relativeAge = (performance.now() - startedAtMillis) / lengthSeconds / 1000;
                return clamp(relativeAge, 0, 1); 
            },
            running() { return !!id; },
            elapsedSeconds() {
                if (!startedAtMillis) return 0;
                if (id) {
                    return (performance.now() - startedAtMillis) / 1000;
                } else {
                    return lengthSeconds - remainingSeconds;
                }
            },
        };
    }

    function frameLoop() {
        const nowMillis = performance.now();
        Raw.deltaSeconds = (nowMillis - lastTimeMillis) / 1000;
        if (Raw.deltaSeconds > 0.1) Raw.deltaSeconds = 1/60; // Unngår altfor store hopp når andre faner vises
        lastTimeMillis = nowMillis;
        Raw.timeSeconds += Raw.deltaSeconds;
        
        measureFps(nowMillis);

        if (typeof Physics !== 'undefined') Physics.update(Raw.deltaSeconds);
        if (typeof Physics2 !== 'undefined') Physics2.update(Raw.deltaSeconds);
        if (typeof Fluid !== 'undefined') Fluid.update(Raw.deltaSeconds);

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

                    if (node.target.position) {
                        node.position.x = Raw.lerp(node.position.x, node.target.position.x, node.target.speed);
                        node.position.y = Raw.lerp(node.position.y, node.target.position.y, node.target.speed);
                    }
                    if (node.target.rotation !== undefined) {
                        node.rotation = Raw.lerp(node.rotation, node.target.rotation, node.target.speed);
                    }
                    if (node.target.scale !== undefined) {
                        node.scale.x = Raw.lerp(node.scale.x, node.target.scale.x, node.target.speed);
                        node.scale.y = Raw.lerp(node.scale.y, node.target.scale.y, node.target.speed);
                    }

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
                    }

                    if (obj.hitbox) {
                        const hitbox = node.object.hitbox.map(corner => 
                            obj.origin ? subtract(corner, obj.origin) : corner
                        );
                        const topleft = matrix.transformPoint(hitbox[0]);
                        const bottomright = matrix.transformPoint(hitbox[1]);
                        node.globalHitbox = [
                            {x: topleft.x/window.devicePixelRatio, y: topleft.y/window.devicePixelRatio}, 
                            {x: bottomright.x/window.devicePixelRatio, y: bottomright.y/window.devicePixelRatio}
                        ];
                    }
                }
            },
            (node) => {
                const obj = node.object;

                // X. Move to draw origin:
                // TODO: Bør dette hete draw origin, siden det ikke faktisk flytter children?
                obj.origin && ctx.translate(-obj.origin.x, -obj.origin.y);

                if (obj && obj.draw) {
                    obj.draw.call(node, ctx, canvas);
                }
                if (Raw.settings.debug) {
                    drawDebug(node);
                }
                ctx.restore();
            }
        );

        if (Raw.settings.debug) {
            Raw.collision.draw(ctx, canvas);
        }

        Raw.collision.update(Raw.deltaSeconds);

        frameCount++;
        requestAnimationFrame(frameLoop);
    };

    // TODO: Litt DRY med den under:
    Raw.bringToFront = function(node) {
        if (!node.parent) return;
        
        const siblings = node.parent.children;
        const index = siblings.indexOf(node);
        if (index >= 0) {
            siblings.splice(index, 1);
            siblings.push(node);
        }
    };

    Raw.bringToBack = function(node) {
        if (!node.parent) return;
        
        const siblings = node.parent.children;
        const index = siblings.indexOf(node);
        if (index >= 0) {
            siblings.splice(index, 1);
            siblings.unshift(node);
        }
    };

    Raw.resize = function() {
        const ratio = window.devicePixelRatio || 1;

        console.log("Resizing canvas:", canvas.parentElement.clientWidth, canvas.parentElement.clientHeight, ratio);

        canvas.width = canvas.parentElement.clientWidth * ratio;
        canvas.height = canvas.parentElement.clientHeight * ratio;

        Raw.scenegraph.object.hitbox = [
            {x: -canvas.width / ratio / 2, y: -canvas.height / ratio / 2},
            {x: canvas.width / ratio / 2, y: canvas.height / ratio / 2},
        ];

        ctx.reset();
        ctx.scale(ratio, ratio);

        // TODO: Dette burde være en vector med navn dimensions eller size:
        Raw.width = canvas.width / ratio;
        Raw.height = canvas.height / ratio;

        Raw.topLeft = {x: -Raw.width/2, y: -Raw.height/2};
        Raw.bottomRight = {x: Raw.width/2, y: Raw.height/2};
    };

    function setMouseFromEvent(event) {
        const offsetX = event.offsetX || event.touches[0] && event.touches[0].clientX;
        const offsetY = event.offsetY || event.touches[0] && event.touches[0].clientY;

        // TODO: Rename til Raw.pointer
        Raw.mouse.x = offsetX - canvas.width / window.devicePixelRatio / 2;
        Raw.mouse.y = offsetY - canvas.height / window.devicePixelRatio / 2;
    }

    function onMouseDown(event) {
        setMouseFromEvent(event);
        Raw.mouse.down = true;
        let targetNode = null;

        traverse(Raw.scenegraph, (node) => {
            if (node.globalHitbox) {
                const globalHitbox = node.globalHitbox;
                const globalMouse = {
                    x: event.offsetX || event.touches[0].clientX,
                    y: event.offsetY || event.touches[0].clientY,
                };
                if (globalMouse.x >= globalHitbox[0].x && globalMouse.x <= globalHitbox[1].x &&
                    globalMouse.y >= globalHitbox[0].y && globalMouse.y <= globalHitbox[1].y) {
                    targetNode = node;
                }
            }
        });

        if (Raw.settings.debug) console.log("Mouse down:", Raw.mouse.x, Raw.mouse.y, targetNode.id);

        // TODO: Rename onmousedown på noden til onpointerdown osv for alle eventer
        if (targetNode && targetNode.object.onmousedown) {
            targetNode.object.onmousedown.call(targetNode, event);
        }

        dragDown(event);
    }

    function onMouseUp(event) {
        setMouseFromEvent(event);
        Raw.mouse.down = false;

        let targetNode = null;

        // TODO: DRY med onMouseDown
        traverse(Raw.scenegraph, (node) => {
            if (node.globalHitbox) {
                const globalHitbox = node.globalHitbox;
                const globalMouse = {
                    x: event.offsetX || event.touches[0].clientX,
                    y: event.offsetY || event.touches[0].clientY,
                };
                if (globalMouse.x >= globalHitbox[0].x && globalMouse.x <= globalHitbox[1].x &&
                    globalMouse.y >= globalHitbox[0].y && globalMouse.y <= globalHitbox[1].y) {
                    targetNode = node;
                }
            }
        });

        if (targetNode && targetNode.object.onmouseup) {
            targetNode.object.onmouseup.call(targetNode, event);
        }

        dragUp(event);
    }

    function onMouseMove(event) {
        setMouseFromEvent(event);

        traverse(Raw.scenegraph, (node) => {
            const obj = node.object;
            if (obj && obj.onmousemove) {
                obj.onmousemove.call(node, Raw.mouse.x, Raw.mouse.y, event);
            }
        });

        dragMove(event);
    }

    const drag = {
        active: false,
        pointerId: null,
        target: null,
        offsetX: 0,
        offsetY: 0
    };

    Raw.startDrag = function(node) {
        drag.active = true;
        drag.target = node.position;
    }

    function dragDown(e) {
        if (!drag.active) return;

        canvas.setPointerCapture(e.pointerId);

        const pos = {
            x: e.clientX,
            y: e.clientY,
        };
        
        drag.pointerId = e.pointerId;
        
        drag.offsetX = pos.x - drag.target.x;
        drag.offsetY = pos.y - drag.target.y;
    }

    function dragMove(e) {
        if (!drag.active || e.pointerId !== drag.pointerId) return;

        const pos = {
            x: e.clientX,
            y: e.clientY,
        };

        drag.target.x = pos.x - drag.offsetX;
        drag.target.y = pos.y - drag.offsetY;
    }

    function dragUp(e) {
        if (e.pointerId !== drag.pointerId) return;

        drag.active = false;
        drag.pointerId = null;
        drag.target = null;
    }

    Raw.init = function(containerElement) {
        canvas = document.createElement("canvas");

        // TODO: Rename alle disse til pointerXX
        canvas.addEventListener("pointerdown", onMouseDown);
        canvas.addEventListener("pointerup", onMouseUp);
        canvas.addEventListener("pointermove", onMouseMove);
        canvas.addEventListener('pointercancel', dragUp);
        canvas.addEventListener('lostpointercapture', dragUp);


        canvas.style.width = "inherit"; // To fill parent
        canvas.style.height = "inherit";
        canvas.style.display = "block"; // To not be inline

        // For dragging:
        canvas.style.touchAction = "none";
        canvas.style.userSelect = "none";
        document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

        containerElement.appendChild(canvas);

        ctx = canvas.getContext("2d");

        // TODO: Noen ganger må klienten ha tilgang til ctx utenom draw og transform, 
        // f.eks. for å lage en imageData med ctx.createImageData()
        // eller tegne pixelart med ctx.imageSmoothingEnabled = false
        //Raw.sketchyAccessToCtx = ctx;

        // Performance settings:
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        Raw.resize();
        window.addEventListener("resize", Raw.resize);
        
        requestAnimationFrame(frameLoop); // TODO: Dette bør kanskje brukeren av Raw gjøre selv, og så er hele frameLoop() heller tilgjengelig for brukeren å kalle selv i sin animationFrame
    }
})();