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