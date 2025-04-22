export class Logger {
    public static logLevel = 0;
    public static log(object: any, verbosity: number = 1) {
        if (verbosity <= this.logLevel) {
            console.log(object);
        }
    }
}
