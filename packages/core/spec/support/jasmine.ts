export default {
    spec_dir: "spec",
    spec_files: ["**/*[sS]pec.ts"],
    helpers: ["helpers/**/*.ts"],
    env: {
        stopSpecOnExpectationFailure: false,
        random: true,
        forbidDuplicateNames: true,
    },
};
