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
    
    let fpsLastTimeMillis = performance.now();
    Raw.fps = 0;
    let fpsCounter = 0;

    let mouseTargetNode = null;

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

    Raw.camera = {
        position: {x: 0, y: 0}, // TODO: Sett default til midt på canvas, i stedet for å alltid gjør offset i transform-funksjonen
        rotation: 0,
        zoom: 0, // -infinity (infinite zoomed out) ... 0 (no zoom) ... 0.99999 (infinite magnification)
        target: {speed: 0.05},
    };

    function updateCamera() {
        Raw.camera.zoom = Math.min(Raw.camera.zoom, 0.99999);
        Raw.camera.scale = 1/(1 - Raw.camera.zoom);

        Raw.topLeft = Raw.scale({x: -Raw.width/2, y: -Raw.height/2}, 1/Raw.camera.scale);
        Raw.bottomRight = Raw.scale({x: Raw.width/2, y: Raw.height/2}, 1/Raw.camera.scale);
    }

    Raw.scenegraph = {
        id: 'root',
        object: { // TODO: Rename til data, og bruk den kun for data, ikke funksjoner som transform
            update: function() {
                // TODO: Dette er av flere eksempler hvor en lokal variabel i stedet for Raw.camera sparer mye plass i minifisert kode. 
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
                    parent.children.splice(parent.children.indexOf(this), 1);
                }
            };

            if (object.hitbox) {
                const oncollision = object.oncollision ? object.oncollision.bind(node) : null;

                if (Array.isArray(object.hitbox)) {
                    object.collisionNode = Raw.collision.addBody(
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


        Raw.collision.update(Raw.deltaSeconds);

        if (Raw.settings.debug) {
            Raw.collision.draw(ctx, canvas);
        }

        frameCount++;
    };

    // TODO: Skal sånne ting være en funksjon på noden heller? Gjelder flere ting som f.eks. Raw.startDrag
    Raw.bringToFront = function(node) {
        const siblings = node.parent.children;
        const index = siblings.indexOf(node);
        if (index >= 0) {
            siblings.splice(index, 1);
            siblings.push(node);
        }
    };

    Raw.bringToBack = function(node) {
        const siblings = node.parent.children;
        const index = siblings.indexOf(node);
        if (index >= 0) {
            siblings.splice(index, 1);
            siblings.unshift(node);
        }
    };

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

        const mouse = Raw.scenegraph.add({
            id: "Raw.mouse",
            hitbox: { position: {x: 0, y: 0}, radius: 0 }, // TODO: Det er kanskje forvirrende at man kan sende inn position i tillegg til posisjonen noden allerede har. Dropp det og anta at alle er rundt origin
            //hitbox: [ { x: -15, y: -15 }, { x: 15, y: -15 }, { x: 15, y: 15 }, { x: -15, y: 15 } ],
            collisionGroup: "none",
            collisionAffectedByGroups: ["all"],
            update: function() {
                this.position.x = Raw.mouse.x;
                this.position.y = Raw.mouse.y;
            },
            oncollision: function(other, direction) {
                if (direction === "in") {
                    traverse(Raw.scenegraph, (node) => {
                        if (node.id === other.id) {
                            mouseTargetNode = node;
                        }
                    });
                } else {
                    mouseTargetNode = null;
                }
                
                console.log("Mouse collision:", direction, other.id);
            },
        });
    }

    return Raw;
})();