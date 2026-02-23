const fs = require("fs");
const path = require("path");

const entryFile = path.resolve(process.argv[2] || "../index.js");
const outputFile = path.resolve(process.argv[3] || "../../Nationaltheatret/raw-canvas/bundle.js");
const visited = new Set();
let output = "";

const WATCH_DIR = path.dirname(entryFile);

function minifyJS(code) {
    const strings = [];
    code = code.replace(/(['"])(?:\\.|(?!\1).)*\1/g, s => {
        strings.push(s);
        return `__STR${strings.length - 1}__`;
    });

    code = code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s*([=+\-*/{}();,:<>])\s*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

    return code.replace(/__STR(\d+)__/g, (_, i) => strings[i]);
}

function includer(file) {
    console.log(`Including ${file}`);

    file = path.resolve(file);
    if (visited.has(file)) return;
    visited.add(file);

    const code = fs.readFileSync(file, "utf8");

    const regex = /[ \t]*(\/\/)?[ \t]*#include "(.+)"/g;

    const processed = code.replace(regex, (match, _, filePath) => {
        const resolved = path.resolve(
            path.dirname(file),
            filePath
        );
        
        const processedContent = includer(resolved);
        return processedContent;
    })

    return processed;
}

function build() {
    visited.clear();
    output = "";

    output = includer(entryFile);

    //output = minifyJS(output);

    fs.writeFileSync(outputFile, output);

    console.log("Built into", outputFile);
}

function onChange(filePath, eventType) {
    console.log(`File changed: ${filePath} (${eventType})`);
    
    build();
}

// Initial watch
fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    const fullPath = path.join(WATCH_DIR, filename);
    if (fullPath === outputFile) return;
    onChange(fullPath, eventType);
});

build();
console.log(`Watching ${WATCH_DIR} ...`);
