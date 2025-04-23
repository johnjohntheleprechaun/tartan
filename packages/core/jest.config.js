export default {
    testEnvironment: 'node',
    roots: [
        './test/',
    ],
    testMatch: ['**/*.test.ts', '*.test.ts'],
    transform: {
        '^.+\\.ts?$': 'ts-jest'
    }
};
