import { DEBOUNCE_ENVIRONMENT_VARIABLE } from "../../src/inputs/files";

beforeAll(async () => {
    process.env[DEBOUNCE_ENVIRONMENT_VARIABLE] = "0";
});
