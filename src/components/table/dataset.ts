import { Accessor, createEffect, createMemo } from "solid-js";
import { createStore, NotWrappable, StoreSetter, unwrap } from "solid-js/store";
import { CustomPartial } from "solid-js/store/types/store.js";
import { deepCopy, deepDiff, Mutation } from "~/utilities";


export type DataSetRowNode<K, T> = { kind: 'row', key: K, value: T }
export type DataSetGroupNode<K, T> = { kind: 'group', key: K, groupedBy: keyof T, nodes: DataSetNode<K, T>[] };
export type DataSetNode<K, T> = DataSetRowNode<K, T> | DataSetGroupNode<K, T>;

export interface SortingFunction<T> {
    (a: T, b: T): -1 | 0 | 1;
}
export interface SortOptions<T extends Record<string, any>> {
    by: keyof T;
    reversed: boolean;
    with?: SortingFunction<T>;
}

export interface GroupingFunction<K, T> {
    (nodes: DataSetRowNode<K, T>[]): DataSetNode<K, T>[];
}
export interface GroupOptions<T extends Record<string, any>> {
    by: keyof T;
    with?: GroupingFunction<number, T>;
}
interface DataSetState<T extends Record<string, any>> {
    value: (T | undefined)[];
    snapshot: (T | undefined)[];
    sorting?: SortOptions<T>;
    grouping?: GroupOptions<T>;
}

export type Setter<T> =
    | T
    | CustomPartial<T>
    | ((prevState: T) => T | CustomPartial<T>);

export interface DataSet<T extends Record<string, any>> {
    data: T[];
    value: Accessor<DataSetNode<keyof T, T>[]>;
    mutations: Accessor<Mutation[]>;
    sorting: Accessor<SortOptions<T> | undefined>;
    grouping: Accessor<GroupOptions<T> | undefined>;

    // mutate<K extends keyof T>(index: number, value: T): void;
    mutate<K extends keyof T>(index: number, prop: K, value: T[K]): void;
    remove(indices: number[]): void;
    insert(item: T, at?: number): void;

    sort(options: Setter<SortOptions<T> | undefined>): DataSet<T>;
    group(options: Setter<GroupOptions<T> | undefined>): DataSet<T>;
}

const defaultComparer = <T>(a: T, b: T) => a < b ? -1 : a > b ? 1 : 0;
function defaultGroupingFunction<T>(groupBy: keyof T): GroupingFunction<number, T> {
    return <K>(nodes: DataSetRowNode<K, T>[]): DataSetNode<K, T>[] => Object.entries(Object.groupBy(nodes, r => r.value[groupBy] as PropertyKey))
        .map(([key, nodes]) => ({ kind: 'group', key, groupedBy: groupBy, nodes: nodes! } as DataSetGroupNode<K, T>));
}

export const createDataSet = <T extends Record<string, any>>(data: T[], initialOptions?: { sort?: SortOptions<T>, group?: GroupOptions<T> }): DataSet<T> => {
    const nodes = data;
    const [state, setState] = createStore<DataSetState<T>>({
        value: deepCopy(nodes),
        snapshot: nodes,
        sorting: initialOptions?.sort,
        grouping: initialOptions?.group,
    });

    const value = createMemo(() => {
        const sorting = state.sorting;
        const grouping = state.grouping;

        let value: DataSetNode<number, T>[] = state.value
            .map<DataSetRowNode<number, T> | undefined>((value, key) => value === undefined ? undefined : ({ kind: 'row', key, value }))
            .filter(node => node !== undefined);

        if (sorting) {
            const comparer = sorting.with ?? defaultComparer;

            value = value.filter(entry => entry.kind === 'row').toSorted((a, b) => comparer(a.value[sorting.by], b.value[sorting.by]));

            if (sorting.reversed) {
                value.reverse();
            }
        }

        if (grouping) {
            const implementation = grouping.with ?? defaultGroupingFunction(grouping.by);

            value = implementation(value as DataSetRowNode<number, T>[]);
        }

        return value as DataSetNode<keyof T, T>[];
    });

    const mutations = createMemo(() => {
        // enumerate all values to make sure the memo is recalculated on any change
        Object.values(state.value).map(entry => Object.values(entry ?? {}));

        return deepDiff(state.snapshot, state.value).toArray();
    });

    const sorting = createMemo(() => state.sorting);
    const grouping = createMemo(() => state.grouping);

    const set: DataSet<T> = {
        data,
        value,
        mutations,
        sorting,
        grouping,

        mutate(index, prop, value) {
            setState('value', index, prop as any, value);
        },

        remove(indices) {
            setState('value', value => value.map((item, i) => indices.includes(i) ? undefined : item));
        },

        insert(item, at) {
            if (at === undefined) {
                setState('value', state.value.length, item);
            } else {

            }
        },

        sort(options) {
            setState('sorting', options);

            return set;
        },

        group(options) {
            setState('grouping', options)

            return set;
        },
    };

    return set
};