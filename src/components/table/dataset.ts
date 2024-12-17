import { Accessor, createMemo } from "solid-js";
import { createStore, NotWrappable, StoreSetter } from "solid-js/store";
import { snapshot } from "vinxi/dist/types/runtime/storage";
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

export interface GroupingFunction<T> {
    (nodes: DataSetRowNode<keyof T, T>[]): DataSetNode<keyof T, T>[];
}
export interface GroupOptions<T extends Record<string, any>> {
    by: keyof T;
    with: GroupingFunction<T>;
}
interface DataSetState<T extends Record<string, any>> {
    value: DataSetRowNode<keyof T, T>[];
    snapshot: DataSetRowNode<keyof T, T>[];
    sorting?: SortOptions<T>;
    grouping?: GroupOptions<T>;
}

export interface DataSet<T extends Record<string, any>> {
    data: T[];
    value: Accessor<DataSetNode<keyof T, T>[]>;
    mutations: Accessor<Mutation[]>;
    sort: Accessor<SortOptions<T> | undefined>;

    // mutate<K extends keyof T>(index: number, value: T): void;
    mutate<K extends keyof T>(index: number, prop: K, value: T[K]): void;

    setSorting(options: SortOptions<T> | undefined): void;
    setGrouping(options: GroupOptions<T> | undefined): void;
}

const defaultComparer = <T>(a: T, b: T) => a < b ? -1 : a > b ? 1 : 0;
function defaultGroupingFunction<T>(groupBy: keyof T): GroupingFunction<T> {
    return (nodes: DataSetRowNode<keyof T, T>[]): DataSetNode<keyof T, T>[] => Object.entries(Object.groupBy(nodes, r => r.value[groupBy] as PropertyKey))
        .map(([key, nodes]) => ({ kind: 'group', key, groupedBy: groupBy, nodes: nodes! } as DataSetGroupNode<keyof T, T>));
}

export const createDataSet = <T extends Record<string, any>>(data: T[]): DataSet<T> => {
    const nodes = data.map<DataSetRowNode<keyof T, T>>((value, key) => ({ kind: 'row', key: key as keyof T, value }));

    const [state, setState] = createStore<DataSetState<T>>({
        value: deepCopy(nodes),
        snapshot: nodes,
        sorting: undefined,
        grouping: undefined,
    });

    const value = createMemo(() => {
        const sorting = state.sorting;
        const grouping = state.grouping;

        let value = state.value as DataSetNode<keyof T, T>[];

        if (sorting) {
            const comparer = sorting.with ?? defaultComparer;

            value = value.filter(entry => entry.kind === 'row').toSorted((a, b) => comparer(a.value[sorting.by], b.value[sorting.by]));

            if (sorting.reversed) {
                value.reverse();
            }
        }

        if (grouping) {
            const implementation = grouping.with ?? defaultGroupingFunction(grouping.by);

            value = implementation(value as DataSetRowNode<keyof T, T>[]);
        }

        return value;
    });

    const mutations = createMemo(() => {
        // enumerate all values to make sure the memo is recalculated on any change
        Object.values(state.value).map(entry => Object.values(entry));

        return deepDiff(state.snapshot, state.value).toArray();
    });
    const sort = createMemo(() => state.sorting);

    return {
        data,
        value,
        mutations,
        sort,

        mutate(index, prop, value) {
            console.log({ index, prop, value });
            // setState('value', index, 'value', prop as any, value);
        },

        setSorting(options) {
            setState('sorting', options);
        },

        setGrouping(options) {
            setState('grouping', options)
        },
    };
};