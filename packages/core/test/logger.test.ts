import {Logger} from "../src/logger";

describe("Test log level logic", () => {
    let logSpy: jest.SpyInstance;
    beforeAll(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });
    beforeEach(() => {
        logSpy.mockClear();
        Logger.logLevel = Logger.defaultLogLevel;
    });

    test("default log level shouldn't be called", () => {
        Logger.log("adfasdf");
        expect(logSpy).not.toHaveBeenCalled();
    });

    test("a message with the default verbosity should be logged when logLevel is set to 1", () => {
        Logger.logLevel = 1;
        Logger.log("adfasdf");
        expect(logSpy).toHaveBeenCalled();
    });

    test("logging at level 0 should be logged with no changes to the logger", () => {
        Logger.log("this should be logged", 0);
        expect(logSpy).toHaveBeenCalled();
    });

    test("a log level greater than or equal to the verbosity specified at call time should mean it's always logged", () => {
        Logger.logLevel = 10;
        Logger.log("asdf", 3);
        Logger.log("asdf", 10);
        Logger.log("asdf", 5);
        Logger.log("asdf", 1);
    })
})
