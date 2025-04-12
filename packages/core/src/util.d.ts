/*
 * Utility types
 */

export type ReplaceTypes<T, R extends Partial<Record<keyof T, any>>> = Omit<T, keyof R> & R;
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
