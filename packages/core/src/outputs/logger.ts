export enum LogLevel {
    Silent = 0,
    Errors = 1,
    Warnings = 2,
    Info = 3,
    Verbose = 4,
}
export class Logger {
    public static defaultLogLevel = 0; // no logs by default
    public static logLevel = this.defaultLogLevel;
    public static log(object: any, verbosity: LogLevel = 3) {
        if (verbosity <= this.logLevel) {
            console.log(object);
        }
    }
}
