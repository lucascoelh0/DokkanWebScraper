import { readdir, readFile, writeFile } from "fs/promises";
import { resolve, extname } from "path";

export async function writeFormattedJson(filePath: string, data: unknown): Promise<void> {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8' });
}

export async function formatJsonFiles(paths?: string[]): Promise<string[]> {
    const targetPaths = paths && paths.length > 0
        ? paths.map(path => resolve(path))
        : await defaultJsonFiles();

    for (const filePath of targetPaths) {
        const rawJson = await readFile(filePath, { encoding: 'utf8' });
        await writeFormattedJson(filePath, JSON.parse(rawJson));
    }

    return targetPaths;
}

async function defaultJsonFiles(): Promise<string[]> {
    const dataDir = resolve(__dirname, 'data');
    const files = await readdir(dataDir, { withFileTypes: true });

    return files
        .filter(file => file.isFile() && extname(file.name).toLowerCase() === '.json')
        .map(file => resolve(dataDir, file.name))
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
