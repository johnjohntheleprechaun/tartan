import { HandoffHandler } from "@tartan/core";
import { Application } from "typedoc";

const handler: HandoffHandler = async (outputDir: string) => {
    const app = await Application.bootstrap({
        entryPoints: ["packages/core"],
        entryPointStrategy: "packages",
    });

    const project = await app.convert();
    if (project) {
        await app.generateDocs(project, outputDir);
    }
};
export default handler;
