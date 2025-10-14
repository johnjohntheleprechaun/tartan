import { firstValueFrom, Observable, of, take, timeout, toArray } from "rxjs";
import { efficientConcatMap } from "../../src/processors/operators.js";
import { asyncFrom } from "../utils/observable.js";

describe("The efficient concat map operator", () => {
    it("should at least execute the function once", async () => {
        const func = (num: number) => num * 2;
        const observable = of([4] as [number]).pipe(efficientConcatMap(func));
        expect(await firstValueFrom(observable)).toBe(8);
    });
    it("should not emit if param didn't change", async () => {
        const func: (a: any) => Promise<any> = (a: number) =>
            new Promise((res) => setTimeout(() => res(a), 10));

        const observable = asyncFrom([[2], [2]] as [number][]).pipe(
            efficientConcatMap(func),
            timeout({
                each: 50,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([2, Infinity]);
    });
    it("should emit if param changed", async () => {
        const func: (a: any) => any = (a: number) => a;

        const observable = asyncFrom([[2], [5]] as [number][]).pipe(
            efficientConcatMap(func),
            timeout({
                each: 500,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([2, 5]);
    });
    it("should not emit if only an unaccessed property changed", async () => {
        const func: (a: any) => any = (a: any) => a.used;
        //new Promise((res) => res(a.used));

        const params = [
            [
                {
                    used: 10,
                    notUsed: 10,
                },
            ],
            [
                {
                    used: 10,
                    notUsed: 30,
                },
            ],
        ] as [any][];

        const observable = asyncFrom(params).pipe(
            efficientConcatMap(func),
            timeout({
                each: 50,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([10, Infinity]);
    });
    it("should emit if only an accessed property changed", async () => {
        const func: (a: any) => any = (a: any) => a.used;
        //new Promise((res) => setTimeout(() => res(a.used)));

        const params = [
            [
                {
                    used: 10,
                    notUsed: 10,
                },
            ],
            [
                {
                    used: 20,
                    notUsed: 30,
                },
            ],
        ] as [any][];

        const observable = asyncFrom(params).pipe(
            efficientConcatMap(func),
            timeout({
                each: 500,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([10, 20]);
    });
    it("should allow the function to be provided by an observable", async () => {
        const func: Observable<(num: number) => number> = asyncFrom([
            (num: number) => num * 2,
            (num: number) => num * 4,
        ]);

        const observable = of([2] as [number]).pipe(
            efficientConcatMap(func),
            take(2),
            toArray(),
        );
        expect(await firstValueFrom(observable)).toEqual([4, 8]);
    });
    it("should re-call a function if different param was provided during execution", async () => {
        const func: (a: any) => any = (a: any) =>
            new Promise((res) => setTimeout(() => res(a), 100));

        const params = [[2], [4]] as [any][];

        const observable = asyncFrom(params).pipe(
            efficientConcatMap(func),
            timeout({
                each: 500,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([2, 4]);
    });
    it("should ignore all but the latest params if multiple were provided during execution", async () => {
        const func: (a: any) => any = (a: any) =>
            new Promise((res) => setTimeout(() => res(a), 100));

        const params = [[2], [4], [8], [10]] as [any][];

        const observable = asyncFrom(params).pipe(
            efficientConcatMap(func),
            timeout({
                each: 500,
                with: () => of(Infinity),
            }),
        );

        const results = await firstValueFrom(
            observable.pipe(take(2), toArray()),
        );
        expect(results).toEqual([2, 10]);
    });
});
