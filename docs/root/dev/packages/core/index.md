## Code Structure

All code is in `src`, of course, and types are in `src/types/`.
Then we have the `inputs` and `outputs` directories. These contain the code for things that Tartan either inputs or outputs during an execution.
The reason these directories are separate is because loading files, modules, or objects, in a way that's reactive and containerized (in the case of modules) can be very complex.

### Inputs

The `inputs` directory holds the code for loading files and modules, and watching them for changes.
Loading files was pretty simple, just read the file and re-read it when it changes, no problem.
Loading modules was far more complicated, and involved some fun stuff with `esbuild` and `node:vm`.
It was honestly really fun to figure out.
The code itself should have good enough comments for you to be able to follow it, assuming you have a basic grasp of rxjs of course.

### Outputs

Currently this directory only holds the logger. The logger is really simple, you wouldn't even need comments to understand it.

## Testing

Tests (or specs, as you might call them) are in the `specs` directory (wow I never would've guessed).
For simplicity, the directory structure of `specs` matches `src`, the only difference being that it's `.spec.ts` not `.ts`.
There's also a `utils` directory, which holds, you guessed it, utility functions, and the `helpers` directory, which has various jasmine helper functions.

### Utils

For the most part this is simply file operation helpers that simplify the temp file creation used for the tests.
It's _very_ important that you use these, since they also trigger fs events for the mocked `FileWatcher`.

The other utility function is `performOperationAfterEachEmission`, which is useful for testing, for example, reloading a file.
You provide an observable, and a list of asynchronous functions. After each emission from the observable, the next function in the list is called and awaited.
(The first function is called only after the first emission from the observable).
Here's an example, which changes the source file only after the file has been loaded:

```
const filename: string = await makeTempFile("changed-file.txt", "1");
const fileObservable = loadFile(filename);
const results = await performOperationAfterEachEmission(
    fileObservable,
    [async () => await updateTempFile("changed-file.txt", "2")],
);
expect(results.map((val) => val.toString())).toEqual(["1", "2"]);
```

### Helpers

There are two helper files, one that sets environment variables to control the testing environment, and one that handles file operations and temp directory setup.
They're pretty self explanatory, so I won't really go into it here.
