export class Logger {
    public static defaultLogLevel = 0; // no logs by default
    public static logLevel = this.defaultLogLevel;
    public static log(object: any, verbosity: number = 1) {
        if (verbosity <= this.logLevel) {
            console.log(object);
        }
    }
}
