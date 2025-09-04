export default {
    spec_dir: "spec",
    spec_files: ["**/*.spec.ts", "!old/**"],
    helpers: ["helpers/**/*.ts"],
    env: {
        stopSpecOnExpectationFailure: false,
        random: true,
        forbidDuplicateNames: true,
    },
};
