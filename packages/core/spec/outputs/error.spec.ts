import { firstValueFrom, map, toArray } from "rxjs";
import { asyncFrom } from "../utils/observable.js";
import { gracefulError } from "../../src/outputs/error.js";
import { Logger } from "../../src/outputs/logger.js";

describe("The graceful error handle operator", () => {
    it("should not destroy the stream", async () => {
        const logSpy = spyOn(Logger, "log");
        const stream = asyncFrom([1, 2, 3, 4, 5]).pipe(
            map((val) => {
                if (val === 3) {
                    throw "three";
                } else {
                    return val;
                }
            }),
            gracefulError("nullId", "pathForNode", "nothing, really"),
        );
        const results = await firstValueFrom(stream.pipe(toArray()));
        expect(logSpy).toHaveBeenCalled();
        expect(results).toHaveSize(4);
        expect(results).toEqual([1, 2, 4, 5]);
    });
});
