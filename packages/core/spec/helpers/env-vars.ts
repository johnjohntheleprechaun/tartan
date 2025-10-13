import { DEBOUNCE_ENVIRONMENT_VARIABLE } from "../../src/inputs/files.js";

beforeAll(async () => {
    process.env[DEBOUNCE_ENVIRONMENT_VARIABLE] = "0";
});
