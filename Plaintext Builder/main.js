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

function bundle(file) {
    console.log(`Bundling ${file}`);

    file = path.resolve(file);
    if (visited.has(file)) return;
    visited.add(file);

    let code = fs.readFileSync(file, "utf8");

    // Find import statements
    const importRegex = /import\s+.*?from\s+["'](.+?)["'];?/g;
    let match;

    while ((match = importRegex.exec(code))) {
        let importPath = match[1];

        if (importPath.startsWith(".")) {
            let resolved = path.resolve(
                path.dirname(file),
                importPath + ".js"
            );
            bundle(resolved);
        }
    }

    // Remove imports and exports
    code = code
        .replace(importRegex, "")
        .replace(/export\s+/g, "");

    output += "\n" + code;
}

function bundleAll() {
    visited.clear();
    output = "";

    // Run bundler
    bundle(entryFile);

    // Optional IIFE wrapper
    // TODO: wrap ting og eksponer exported greier i et namespace
    //output = `(function () {\n${output}\n})();`;

    //output = minifyJS(output);

    fs.writeFileSync(outputFile, output);

    console.log("Bundled into", outputFile);
}

function onChange(filePath, eventType) {
    console.log(`File changed: ${filePath} (${eventType})`);
    
    bundleAll();
}

// Initial watch
fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    const fullPath = path.join(WATCH_DIR, filename);
    if (fullPath === outputFile) return;
    onChange(fullPath, eventType);
});

bundleAll();
console.log(`Watching ${WATCH_DIR} ...`);
