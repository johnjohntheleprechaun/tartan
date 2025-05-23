export class Logger {
    public static defaultLogLevel = 0;
    public static logLevel = this.defaultLogLevel;
    public static log(object: any, verbosity: number = 1) {
        if (verbosity <= this.logLevel) {
            console.log(object);
        }
    }
}
