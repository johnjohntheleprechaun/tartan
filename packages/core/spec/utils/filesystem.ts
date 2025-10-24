import fs from "node:fs/promises";
import fsSync from "node:fs";
import path, { dirname, join, resolve } from "node:path";
import { fileChanged } from "../helpers/file-ops.js";

export async function getTempFile(name: string): Promise<Buffer> {
    return fs.readFile(join(process.env["TMP_DIR"] || "", name));
}

export async function makeTempFile(
    name: string,
    contents: string,
): Promise<string> {
    if (!process.env["TMP_DIR"]) {
        fail("no temp dir was provided");
    }
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    const highestCreatedDir = await new Promise<string | undefined>((res) => {
        fsSync.mkdir(dirname(filePath), { recursive: true }, (_, path) => {
            res(path);
        });
    });
    await fs.writeFile(filePath, contents);

    if (highestCreatedDir) {
        const newPaths = path.dirname(
            path.relative(path.join(highestCreatedDir, ".."), filePath),
        );

        const segments = newPaths.split(path.sep);

        segments.forEach((_, i) =>
            fileChanged(
                path.resolve(
                    path.join(
                        process.env["TMP_DIR"] as string,
                        ...segments.slice(0, i + 1),
                    ),
                ),
                "create",
            ),
        );
    }

    fileChanged(filePath, "create");
    return filePath;
}

export async function removeTempFile(name: string): Promise<void> {
    if (!process.env["TMP_DIR"]) {
        fail("no temp dir was provided");
    }
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    await fs.rm(filePath);
    fileChanged(filePath, "delete");
}

export async function updateTempFile(
    name: string,
    contents: string,
): Promise<string> {
    const filePath = resolve(join(process.env["TMP_DIR"] as string, name));
    await fs.writeFile(filePath, contents);
    fileChanged(filePath, "update");
    return filePath;
}

export async function makeTempFiles(files: {
    [key: string]: string;
}): Promise<string> {
    await Promise.all(
        Object.entries(files).map(([path, contents]) =>
            makeTempFile(path, contents),
        ),
    );
    return process.env["TMP_DIR"] as string;
}
