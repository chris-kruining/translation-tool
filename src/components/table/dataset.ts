

export type DataSetRowNode<T> = { kind: 'row', key: string, value: T }
export type DataSetGroupNode<T> = { kind: 'group', key: string, groupedBy: keyof T, nodes: DataSetNode<T>[] };
export type DataSetNode<T> = DataSetRowNode<T> | DataSetGroupNode<T>;

export type DataSet<T extends Record<string, any>> = DataSetNode<T>[];

export const createDataSet = <T extends Record<string, any>>(data: T[]): DataSetNode<T>[] => {
    return Object.entries(data).map<DataSetRowNode<T>>(([key, value]) => ({ kind: 'row', key, value }));
};

type SortingFunction<T> = (a: T, b: T) => -1 | 0 | 1;
type SortOptions<T extends Record<string, any>> = { by: keyof T, reversed: boolean, with: SortingFunction<T> };
export const toSorted = <T extends Record<string, any>>(dataSet: DataSet<T>, sort: SortOptions<T>): DataSet<T> => {
    const sorted = dataSet.toSorted((a, b) => sort.with(a.value[sort.by], b.value[sort.by]));

    if (sort.reversed) {
        sorted.reverse();
    }

    return sorted;
};

type GroupingFunction<T> = (nodes: DataSetRowNode<T>[]) => DataSetNode<T>[];
type GroupOptions<T extends Record<string, any>> = { by: keyof T, with: GroupingFunction<T> };
export const toGrouped = <T extends Record<string, any>>(dataSet: DataSet<T>, group: GroupOptions<T>): DataSet<T> => group.with(dataSet as any);