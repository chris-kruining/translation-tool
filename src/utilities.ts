export const splitAt = (subject: string, index: number): readonly [string, string] => {
    return [subject.slice(0, index), subject.slice(index + 1)] as const;
};

export const debounce = <T extends (...args: any[]) => void>(callback: T, delay: number): T => {
    let handle: ReturnType<typeof setTimeout> | undefined;

    return (...args: any[]) => {
        if (handle) {
            clearTimeout(handle);
        }

        handle = setTimeout(() => callback(...args), delay);
    };
};

export const deepCopy = <T>(original: T): T => {
    if (typeof original !== 'object' || original === null || original === undefined) {
        return original;
    }

    if (original instanceof Date) {
        return new Date(original.getTime()) as T;
    }

    if (original instanceof Array) {
        return original.map(item => deepCopy(item)) as T;
    }

    if (original instanceof Set) {
        return new Set(original.values().map(item => deepCopy(item))) as T;
    }

    if (original instanceof Map) {
        return new Map(original.entries().map(([key, value]) => [key, deepCopy(value)])) as T;
    }

    return Object.assign(
        Object.create(Object.getPrototypeOf(original)),
        Object.fromEntries(Object.entries(original).map(([key, value]) => [key, deepCopy(value)]))
    ) as T;
}

export enum MutarionKind {
    Create = 'created',
    Update = 'updated',
    Delete = 'deleted',
}
type Created = { kind: MutarionKind.Create, value: any };
type Updated = { kind: MutarionKind.Update, value: any, original: any };
type Deleted = { kind: MutarionKind.Delete };
export type Mutation = { key: string } & (Created | Updated | Deleted);

export function* deepDiff<T1 extends object, T2 extends object>(a: T1, b: T2, path: string[] = []): Generator<Mutation, void, unknown> {
    if (!isIterable(a) || !isIterable(b)) {
        console.log('Edge cases', a, b);

        return;
    }

    for (const [[keyA, valueA], [keyB, valueB]] of zip(entriesOf(a), entriesOf(b))) {
        if (!keyA && !keyB) {
            throw new Error('this code should not be reachable, there is a bug with an unhandled/unknown edge case');
        }

        if (!keyA && keyB) {
            yield { key: path.concat(keyB.toString()).join('.'), kind: MutarionKind.Create, value: valueB };

            continue;
        }

        if (keyA && !keyB) {
            // value was added
            yield { key: path.concat(keyA.toString()).join('.'), kind: MutarionKind.Delete };

            continue;
        }

        if (typeof valueA == 'object' && typeof valueB == 'object') {
            yield* deepDiff(valueA, valueB, path.concat(keyA!.toString()));

            continue;
        }

        if (valueA === valueB) {
            continue;
        }

        const key = path.concat(keyA!.toString()).join('.');

        yield ((): Mutation => {
            if (valueA === null || valueA === undefined) return { key, kind: MutarionKind.Create, value: valueB };
            if (valueB === null || valueB === undefined) return { key, kind: MutarionKind.Delete };

            return { key, kind: MutarionKind.Update, value: valueB, original: valueA };
        })();
    }
};

const isIterable = (subject: object): subject is Iterable<any> => ['boolean', 'undefined', 'null', 'number'].includes(typeof subject) === false;
const entriesOf = (subject: object): Iterable<readonly [string | number, any]> => {
    if (subject instanceof Array) {
        return subject.entries();
    }

    if (subject instanceof Map) {
        return subject.entries();
    }

    if (subject instanceof Set) {
        return subject.entries();
    }

    return Object.entries(subject);
};
const zip = function* (a: Iterable<readonly [string | number, any]>, b: Iterable<readonly [string | number, any]>): Generator<readonly [[string | number | undefined, any], [string | number | undefined, any]], void, unknown> {
    const iterA = Iterator.from(a);
    const iterB = Iterator.from(b);

    while (true) {
        const { done: doneA, value: entryA = [] } = iterA.next() ?? {};
        const { done: doneB, value: entryB = [] } = iterB.next() ?? {};

        if (doneA && doneB) {
            break;
        }

        yield [entryA, entryB] as const;
    }
};

export interface filter {
    <T, S extends T>(subject: AsyncIterableIterator<T>, predicate: (value: T) => value is S): AsyncGenerator<S, void, unknown>;
    <T>(subject: AsyncIterableIterator<T>, predicate: (value: T) => unknown): AsyncGenerator<T, void, unknown>;
}

export const filter = async function*<T, S extends T>(subject: AsyncIterableIterator<T>, predicate: (value: T) => value is S): AsyncGenerator<S, void, unknown> {
    for await (const value of subject) {
        if (predicate(value)) {
            yield value;
        }
    }
};

