import { TartanInput } from "../types/inputs.js";
import fs from "fs/promises";

export async function loadFile(filepath: string): Promise<TartanInput<Buffer>> {
    return {
        path: filepath,
        value: await fs.readFile(filepath),
    };
}
