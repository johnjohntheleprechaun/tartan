import { FullTartanContext } from "./tartan-context.js";

/**
 * The input to a Halt Controller.
 */
export type HaltControllerInput = {
    sourceDir: string;
    outputDir: string;
    context: FullTartanContext;
};
/**
 * The equivelant of an in-memory filesystem.
 */
export type MockDirectory = { [key: string]: Buffer | MockDirectory };
/**
 * The output of a halt controller.
 */
export type HaltControllerOutput =
    | {
          haltType: "mock";
          /**
           * only used if `haltType` is `mock`.
           */
          mockDirectory: MockDirectory;
      }
    | {
          haltType: "handoff";
          /**
           * only used if `haltType` is `handoff`.
           */
          handoffFunction: (() => Promise<void>) | Promise<void>;
      }
    | {
          haltType: "redirect";
          /**
           * only used if `haltType` is `redirect`.
           */
          targetDirectory: string;
      };
/**
 * Controls handling of pages with the `halt` page mode.
 */
export type HaltController = (
    input: HaltControllerInput,
) => Promise<HaltControllerOutput> | HaltControllerOutput;
