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

export function triangleWave(t) {
    t = Math.abs(t/2);
    const n = t % 1.0;
    return n < 0.5 ? n * 2 : (1 - n) * 2;
}

export function sineWave(t) {
    const n = t*Math.PI - Math.PI/2;
    return 0.5 + Math.sin(n) * 0.5;
}

export function cosineWave(t) {
    return sineWave(t - Math.PI/2);
}

export function easeInWave(t) {
    const f = (t) => {
        const n = t == 1.0 ? 1.0 : (t % 1.0);
        return n * n;
    }
    return repeatFlipped(f, t);
}

export function easeOutWave(t) {
    const f = (t) => {
        const n = t == 1.0 ? 1.0 : (t % 1.0);
        return 1 - (1 - n) * (1 - n);
    }
    return repeatFlipped(f, t);
}

export function easeOutCubicWave(t) {
    const f = (t) => {
        const u = 1 - t;
        return 1 - u * u * u;
    }
    return repeatFlipped(f, t);
}

// Denne er suuuupernærme sineWave. Men den er vel mye raskere enn Math.sin?
export function easeInOutWave(t) {
    const f = (t) => t * t * (3 - 2 * t);
    return repeatFlipped(f, t);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp(value, from, to) {
    let min = from;
    let max = to;
    
    if (to < from) {
        min = to;
        max = from;
    }

    return value < min ? min : value > max ? max : value;
}

export function map(value, inMin, inMax, outMin, outMax, clampValue = false) {
    const t = (value - inMin) / (inMax - inMin);
    const mapped = outMin + (outMax - outMin) * t;
    return clampValue ? clamp(mapped, outMin, outMax) : mapped;
}

export function length(vector) {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

export function distance(vectorA, vectorB) {
    const diff = {x: vectorB.x - vectorA.x, y: vectorB.y - vectorA.y};
    return length(diff);
}

export function normalize(vector) {
    const len = length(vector);
    return len === 0 ? {x: 0, y: 0} : {x: vector.x / len, y: vector.y / len};
}

export function copy(vec) {
    return {x: vec.x, y: vec.y};
}

export function scale(vector, scalar) {
    return {x: vector.x * scalar, y: vector.y * scalar};
}

export function add(vectorA, vectorB) {
    return {x: vectorA.x + vectorB.x, y: vectorA.y + vectorB.y};
}

export function subtract(vectorA, vectorB) {
    return {x: vectorA.x - vectorB.x, y: vectorA.y - vectorB.y};
}

export function fromTo(from, to) {
    return subtract(to, from);
}

export function random(from, to) {
    return from + Math.random() * (to - from);
}

export function randomInt(from, to) {
    return Math.floor(random(from, to + 1));
}

export function lerpVectors(vectorA, vectorB, t) {
    return {
        x: lerp(vectorA.x, vectorB.x, t),
        y: lerp(vectorA.y, vectorB.y, t)
    };
}

export function projectPointOntoLine(point, lineA, lineB) {
    const A = point.x - lineA.x;
    const B = point.y - lineA.y;
    const C = lineB.x - lineA.x;
    const D = lineB.y - lineA.y;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq != 0) // in case of 0 length line
        param = dot / len_sq;

    let xx = lineA.x + param * C;
    let yy = lineA.y + param * D;

    const side = C * B - D * A;

    return {x: xx, y: yy, param, side};
}

// TODO: Vurder å kalle denne centroid:
export function bodyCenter(points) {
    let sumX = 0;
    let sumY = 0;
    points.forEach(point => {
        sumX += point.x;
        sumY += point.y;
    });
    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
}

// TODO: Vurder å standardisere på at funksjoner som tar inn w og h tar inn vektor i stedet
export function gridDistribution(w, h = null) {
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
        points.push({x, y, index, centered});
    }
    return points;
}