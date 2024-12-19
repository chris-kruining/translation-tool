import { describe, beforeEach, it, expect, mock, afterAll, spyOn } from 'bun:test';
import { debounce, deepCopy, deepDiff, filter, map, MutarionKind, splitAt } from './utilities';
import { install } from '@sinonjs/fake-timers';

type MilliSeconds = number;
const useFakeTimers = () => {
    const clock = install();

    beforeEach(() => clock.reset());
    afterAll(() => clock.uninstall());

    return {
        tick(timeToAdvance: MilliSeconds) {
            clock.tick(timeToAdvance);
        },
    };
};
const first = <T>(iterable: Iterable<T>): T | undefined => {
    for (const value of iterable) {
        return value;
    }
}

describe('utilities', () => {
    describe('splitAt', () => {
        it('should split the given string at the given index', async () => {
            // Arrange
            const given = 'this.is.some.concatenated.string';
            const expected = [
                'this.is.some.concatenated',
                'string',
            ] as const;

            // Act
            const [a, b] = splitAt(given, given.lastIndexOf('.'));

            // Assert
            expect(a).toBe(expected[0]);
            expect(b).toBe(expected[1]);
        });

        it('should return an empty second result when the index is negative', async () => {
            // Arrange
            const given = 'this.is.some.concatenated.string';
            const expected = [
                'this.is.some.concatenated.string',
                '',
            ] as const;

            // Act
            const [a, b] = splitAt(given, -1);

            // Assert
            expect(a).toBe(expected[0]);
            expect(b).toBe(expected[1]);
        });

        it('should return an empty second result when the index is larger then subject length', async () => {
            // Arrange
            const given = 'this.is.some.concatenated.string';
            const expected = [
                'this.is.some.concatenated.string',
                '',
            ] as const;

            // Act
            const [a, b] = splitAt(given, given.length * 2);

            // Assert
            expect(a).toBe(expected[0]);
            expect(b).toBe(expected[1]);
        });
    });

    describe('debounce', () => {
        const { tick } = useFakeTimers();

        it('should run the given callback after the provided time', async () => {
            // Arrange
            const callback = mock(() => { });
            const delay = 1000;
            const debounced = debounce(callback, delay);

            // Act
            debounced();
            tick(delay);

            // Assert
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should reset if another call is made', async () => {
            // Arrange
            const callback = mock(() => { });
            const delay = 1000;
            const debounced = debounce(callback, delay);

            // Act
            debounced();
            tick(delay / 2);
            debounced();
            tick(delay);

            // Assert
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('deepCopy', () => {
        it('can skip values passed by reference (non-objects, null, and undefined)', async () => {
            // arrange
            const given = 'some string';

            // Act
            const actual = deepCopy(given);

            // Arrange 
            expect(actual).toBe(given);
        });

        it('should return a value that does not point to same memory', async () => {
            // Arrange
            const given = {};

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual).not.toBe(given);
        });

        it('should handle Date types', async () => {
            // Arrange
            const given = new Date();

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual).not.toBe(given);
        });

        it('should handle Arrays', async () => {
            // Arrange
            const given: any[] = [];

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual).not.toBe(given);
        });

        it('should handle Sets', async () => {
            // Arrange
            const given = new Set();

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual).not.toBe(given);
        });

        it('should handle Maps', async () => {
            // Arrange
            const given = new Map();

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual).not.toBe(given);
        });

        it('should return a value that does not point to same memory for nested properties', async () => {
            // Arrange
            const given = {
                some: {
                    deep: {
                        value: {}
                    }
                }
            };

            // Act
            const actual = deepCopy(given);

            // Assert
            expect(actual.some.deep.value).not.toBe(given.some.deep.value);
        });
    });

    describe('deepDiff', () => {
        it('should immedietly return when either `a` is not iterable', async () => {
            // arrange
            const a: any = 0;
            const b = {};
            const spy = spyOn(console, 'error').mockReturnValue(undefined);

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([]);
            expect(spy).toHaveBeenCalled();
        });

        it('should immedietly return when either `b` is not iterable', async () => {
            // arrange
            const a = {};
            const b: any = 0;
            const spy = spyOn(console, 'error').mockReturnValue(undefined);

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([]);
            expect(spy).toHaveBeenCalled();
        });

        it('should yield no results when both a and b are empty', async () => {
            // arrange
            const a = {};
            const b = {};

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([]);
        });

        it('should yield no results when both a and b are equal', async () => {
            // arrange
            const a = { key: 'value' };
            const b = { key: 'value' };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([]);
        });

        it('should yield a mutation of type create when `b` contains a key that `a` does not', async () => {
            // arrange
            const a = {};
            const b = { key: 'value' };

            // Act
            const actual = first(deepDiff(a, b));

            // Arrange 
            expect(actual).toEqual({ kind: MutarionKind.Create, key: 'key', value: 'value' });
        });

        it('should yield a mutation of type delete when `a` contains a key that `b` does not', async () => {
            // arrange
            const a = { key: 'value' };
            const b = {};

            // Act
            const actual = first(deepDiff(a, b));

            // Arrange 
            expect(actual).toEqual({ kind: MutarionKind.Delete, key: 'key', original: 'value' });
        });

        it('should yield a mutation of type update when the value of a key in `a` is not equal to the value of the same key in `b`', async () => {
            // arrange
            const a = { key: 'old' };
            const b = { key: 'new' };

            // Act
            const actual = first(deepDiff(a, b));

            // Arrange 
            expect(actual).toEqual({ kind: MutarionKind.Update, key: 'key', original: 'old', value: 'new' });
        });

        it('should iterate over nested values', async () => {
            // arrange
            const a = { some: { nested: { key: 'old' } } };
            const b = { some: { nested: { key: 'new' } } };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([{ kind: MutarionKind.Update, key: 'some.nested.key', original: 'old', value: 'new' }]);
        });

        it('should handle deleted keys', async () => {
            // arrange
            const a = { key1: 'value1', key2: 'value2', key3: 'value3', key4: 'value4', key5: 'value5' };
            const b = { key1: 'value1', key4: 'value4', key5: 'value5' };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([
                { kind: MutarionKind.Delete, key: 'key2', original: 'value2' },
                { kind: MutarionKind.Delete, key: 'key3', original: 'value3' },
            ]);
        });

        it('should handle created keys', async () => {
            // arrange
            const a = { key1: 'value1', key4: 'value4', key5: 'value5' };
            const b = { key1: 'value1', key2: 'value2', key3: 'value3', key4: 'value4', key5: 'value5' };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([
                { kind: MutarionKind.Create, key: 'key2', value: 'value2' },
                { kind: MutarionKind.Create, key: 'key3', value: 'value3' },
            ]);
        });

        it('should handle renamed keys', async () => {
            // arrange
            const a = { key1: 'value1', key2_old: 'value2', key3: 'value3' };
            const b = { key1: 'value1', key2_new: 'value2', key3: 'value3', };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([
                { kind: MutarionKind.Delete, key: 'key2_old', original: 'value2' },
                { kind: MutarionKind.Create, key: 'key2_new', value: 'value2' },
            ]);
        });

        it('should handle `Array` values', async () => {
            // arrange
            const a = { key: [1] };
            const b = { key: [2] };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([
                { kind: MutarionKind.Update, key: 'key.0', original: 1, value: 2 },
            ]);
        });

        it('should handle `Set` values', async () => {
            // arrange
            const a = { key: new Set([1, 2, 3]) };
            const b = { key: new Set([1, 5, 3]) };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange
            expect(actual).toEqual([
                { kind: MutarionKind.Delete, key: 'key.2', original: 2 },
                { kind: MutarionKind.Create, key: 'key.5', value: 5 },
            ]);
        });

        it('should handle `Map` values', async () => {
            // arrange
            const a = { key: new Map([['key', 'old']]) };
            const b = { key: new Map([['key', 'new']]) };

            // Act
            const actual = deepDiff(a, b).toArray();

            // Arrange 
            expect(actual).toEqual([
                { kind: MutarionKind.Update, key: 'key.key', original: 'old', value: 'new' },
            ]);
        });
    });

    describe('filter', () => {
        it('should yield a value when the predicate returns true', async () => {
            // arrange
            const generator = async function* () {
                for (const i of new Array(10).fill('').map((_, i) => i)) {
                    yield i;
                }
            };
            const predicate = (i: number) => i % 2 === 0;

            // Act
            const actual = await Array.fromAsync(filter(generator(), predicate as any));

            // Arrange 
            expect(actual).toEqual([0, 2, 4, 6, 8]);
        });
    });

    describe('map', () => {
        const generator = async function* () {
            for (const i of new Array(10).fill('').map((_, i) => i)) {
                yield i;
            }
        };

        it('should yield a value when the predicate returns true', async () => {
            // arrange
            const mapFn = (i: number) => `nr ${i}`;

            // Act
            const actual = await Array.fromAsync(map(generator(), mapFn));

            // Arrange 
            expect(actual).toEqual([
                'nr 0',
                'nr 1',
                'nr 2',
                'nr 3',
                'nr 4',
                'nr 5',
                'nr 6',
                'nr 7',
                'nr 8',
                'nr 9',
            ]);
        });
    });
});
