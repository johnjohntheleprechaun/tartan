import fs from "node:fs/promises";

beforeAll(async () => {
    await fs.rm(".tmp", {
        force: true,
        recursive: true,
    });
    await fs.mkdir(".tmp");
});
beforeEach(async () => {
    const tmpDir = await fs.mkdtemp(".tmp/tartan-test-");
    globalThis.tmpDir = tmpDir;
});
