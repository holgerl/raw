// TODO: properties-navn tar faktisk veldig mye av minifisert kode. Kan de være kortere?

const Raw = (function () {
    const Raw = {};

    // #include "./util.js"
    // #include "./collision2.js"
    // #include "./timer.js"

    Object.assign(Raw, {
        lerp, clamp, fromTo, map, distance, copy, add, subtract, scale, cross, normalize, random, randomInt, bodyCenter, 
        gridDistribution, traverse, triangleWave, easeInOutWave, easeInWave, easeOutWave, easeOutCubicWave, sineWave, cosineWave, 
        timer,
        collision: Collision 
    })

    let canvas, ctx;
    let lastTimeMillis = performance.now();
    let frameCount = 0;
    
    Raw.fps = 0;
    let fpsMillis = performance.now();
    let fpsCounter = 0;

    let mouseTargetNode = null;

    function traverse(node, callbackBefore, callbackAfter = () => {}) {
        callbackBefore(node);
        for (let child of node.children) {
            traverse(child, callbackBefore, callbackAfter);
        }
        callbackAfter(node);
    }

    function measureFps(nowMillis) {
        const fpsDeltaMillis = nowMillis - fpsMillis;
        fpsCounter++;
        if (fpsDeltaMillis >= 100) { // update every x milliseconds
            Raw.fps = Math.round((fpsCounter / fpsDeltaMillis) * 1000);
            fpsCounter = 0;
            fpsMillis = nowMillis;
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
            ctx.font = "10px monospace";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.translate(4, 4); // Padding
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
    
    const c = Raw.camera;

    Raw.scenegraph = {
        id: 'root',
        object: { // TODO: Rename til data, og bruk den kun for data, ikke funksjoner som transform
            update: function() {
                if (c.target.zoom !== undefined) {
                    c.zoom = lerp(c.zoom, c.target.zoom, c.target.speed);
                }
                if (c.target.rotation !== undefined) {
                    c.rotation = lerp(c.rotation, c.target.rotation, c.target.speed);
                }
                if (c.target.position !== undefined) {
                    c.position = lerpVectors(c.position, c.target.position, c.target.speed);
                }
            },    
            transform: function(ctx, canvas) {
                const center = { // Dette setter koordinat (0,0) i scenen midt på canvas, som er praktisk
                    x: Raw.width/2,
                    y: Raw.height/2,
                }
                const translate = subtract(center, c.position);

                updateCamera();

                // TODO: Dette blir ikke riktig når scale og translate gjøres sammen. Må nok bruke pivot riktig slik som i scenegraph ellers
                ctx.translate(translate.x, translate.y);
                ctx.rotate(c.rotation);
                ctx.scale(c.scale, c.scale);
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
                    parent.children.splice(parent.children.indexOf(this), 1);
                }
            };

            if (object.hitbox) {
                const oncollision = object.oncollision ? object.oncollision.bind(node) : null;

                if (Array.isArray(object.hitbox)) {
                    object.collisionNode = Raw.collision.addBody(                                    // TODO: Finn noen kortere navn på fisse feltene:
                        {id: node.id, position: object.position, points: object.hitbox, oncollision, group: object.collisionGroup, affectedByGroups: object.collisionAffectedByGroups}
                    );
                } else {
                    object.collisionNode = Raw.collision.addPoint(
                        {id: node.id, position: object.hitbox.position, radius: object.hitbox.radius, oncollision, group: object.collisionGroup, affectedByGroups: object.collisionAffectedByGroups}
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

    Raw.onFrame = function() {
        const nowMillis = performance.now();
        Raw.deltaSeconds = (nowMillis - lastTimeMillis) / 1000;
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

                    if (node.target.position) {
                        node.position = lerpVectors(node.position, node.target.position, node.target.speed);
                    }
                    if (node.target.rotation !== undefined) {
                        node.rotation = lerp(node.rotation, node.target.rotation, node.target.speed);
                    }
                    if (node.target.scale !== undefined) {
                        node.scale = lerpVectors(node.scale, node.target.scale, node.target.speed);
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
                        obj.collisionNode.rotation = node.rotation;
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


        Raw.collision.update();

        if (Raw.settings.debug) {
            Raw.collision.draw(ctx, canvas);
        }

        frameCount++;
    };

    function remove(array, element) {
        const index = array.indexOf(element);
        if (index >= 0) {
            return array.splice(index, 1);
        }
    }

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

        console.log("Resizing canvas:", width, height, ratio);

        canvas.height = height * ratio;
        canvas.width = width * ratio;
        
        Raw.scenegraph.object.hitbox = [
            {x: -canvas.width / ratio / 2, y: -canvas.height / ratio / 2},
            {x: canvas.width / ratio / 2, y: canvas.height / ratio / 2},
        ];

        ctx.reset();
        ctx.scale(ratio, ratio);

        // TODO: Dette burde være en vector med navn dimensions eller size:
        Raw.width = canvas.width / ratio;
        Raw.height = canvas.height / ratio;

        updateCamera();
    };

    function setMouseFromEvent(event) {
        const offsetX = event.offsetX || event.touches[0] && event.touches[0].clientX;
        const offsetY = event.offsetY || event.touches[0] && event.touches[0].clientY;

        // TODO: Rename til Raw.pointer
        Raw.mouse.x = offsetX - canvas.width / window.devicePixelRatio / 2;
        Raw.mouse.y = offsetY - canvas.height / window.devicePixelRatio / 2;

        const mouse = {type: "point", position: {x: offsetX, y: offsetY}, radius: 0};
        mouse.bbox = Raw.makebbox(mouse);

        mouseTargetNode = null;

        Raw.traverse(Raw.scenegraph, node => {
            if (node.object.collisionNode) {
                node.bbox = Raw.makebbox(node.object.collisionNode);
                const overlap = Collision.checkOverlap(mouse, node.object.collisionNode); 
                if (overlap) mouseTargetNode = node;
            }
        });
    }
    
    function onMouseDown(event) {
        const isPrimaryClick =
            event.button === 0 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey;

        if (!isPrimaryClick) return;

        setMouseFromEvent(event);
        Raw.mouse.down = true;

        if (Raw.settings.debug) console.log("Mouse down:", Raw.mouse.x, Raw.mouse.y, mouseTargetNode && mouseTargetNode.id);

        // TODO: Rename onmousedown på noden til onpointerdown osv for alle eventer
        if (mouseTargetNode && mouseTargetNode.object.onmousedown) {
            mouseTargetNode.object.onmousedown.call(mouseTargetNode, event);
        }
    }

    function onMouseUp(event) {
        setMouseFromEvent(event);
        Raw.mouse.down = false;

        if (mouseTargetNode && mouseTargetNode.object.onmouseup) {
            mouseTargetNode.object.onmouseup.call(mouseTargetNode, event);
        }        

        dragUp(event);
    }

    function onMouseMove(event) {
        setMouseFromEvent(event);

        if (mouseTargetNode && mouseTargetNode.object.onmousemove) {
            mouseTargetNode.object.onmousemove.call(mouseTargetNode, Raw.mouse.x, Raw.mouse.y, event);
        }        

        dragMove(event);
    }

    const drag = {
        active: false,
        pointerId: null,
        target: null,
        offsetX: 0,
        offsetY: 0
    };

    Raw.startDrag = function(target, event) {
        drag.active = true;
        drag.target = target;

        dragDown(event);
    }

    function dragDown(e) {
        canvas.setPointerCapture(e.pointerId);

        const pos = {
            x: e.clientX,
            y: e.clientY,
        };
        
        drag.pointerId = e.pointerId;
        
        // TODO: Bruk vektorer her
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

    Raw.init = function(canvasElement) {
        canvas = canvasElement;

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
        canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

        ctx = canvas.getContext("2d");

        Raw.resize();
        window.addEventListener("resize", (event) => Raw.resize());
    }

    return Raw;
})();