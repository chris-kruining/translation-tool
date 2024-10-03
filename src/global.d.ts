/// <reference types="@solidjs/start/env" />


interface IterableIterator<T> {
    map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): IterableIterator<U>;
    filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): IterableIterator<S>;
    toArray(): T[];
}