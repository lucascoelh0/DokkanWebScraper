"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatJsonFiles = exports.writeFormattedJson = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function writeFormattedJson(filePath, data) {
    await (0, promises_1.writeFile)(filePath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8' });
}
exports.writeFormattedJson = writeFormattedJson;
async function formatJsonFiles(paths) {
    const targetPaths = paths && paths.length > 0
        ? paths.map(path => (0, path_1.resolve)(path))
        : await defaultJsonFiles();
    for (const filePath of targetPaths) {
        const rawJson = await (0, promises_1.readFile)(filePath, { encoding: 'utf8' });
        await writeFormattedJson(filePath, JSON.parse(rawJson));
    }
    return targetPaths;
}
exports.formatJsonFiles = formatJsonFiles;
async function defaultJsonFiles() {
    const dataDir = (0, path_1.resolve)(__dirname, 'data');
    const files = await (0, promises_1.readdir)(dataDir, { withFileTypes: true });
    return files
        .filter(file => file.isFile() && (0, path_1.extname)(file.name).toLowerCase() === '.json')
        .map(file => (0, path_1.resolve)(dataDir, file.name))
        .sort();
}
async function main() {
    const paths = process.argv.slice(2);
    const formattedFiles = await formatJsonFiles(paths);
    console.log(`Formatted ${formattedFiles.length} JSON file(s).`);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=format-json.js.map