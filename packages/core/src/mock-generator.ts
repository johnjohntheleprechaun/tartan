import { DirectoryJSON } from "memfs";

/**
 * An in-memory filesystem.
 */
export type MockDirectory = DirectoryJSON;
/**
 * Controls handling of pages with the `mock` page mode.
 */
export type MockGenerator = () => MockDirectory | Promise<MockDirectory>;
