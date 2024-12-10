

export type RowNode<T> = { kind: 'row', key: string, value: T }
export type GroupNode<T> = { kind: 'group', key: string, groupedBy: keyof T, nodes: Node<T>[] };
export type Node<T> = RowNode<T> | GroupNode<T>;

export type DataSet<T extends Record<string, any>> = Node<T>[];

export const createDataSet = <T extends Record<string, any>>(data: T[]): Node<T>[] => {
    return Object.entries(data).map<RowNode<T>>(([key, value]) => ({ kind: 'row', key, value }));
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

type GroupingFunction<T> = (nodes: RowNode<T>[]) => Node<T>[];
type GroupOptions<T extends Record<string, any>> = { by: keyof T, with: GroupingFunction<T> };
export const toGrouped = <T extends Record<string, any>>(dataSet: DataSet<T>, group: GroupOptions<T>): DataSet<T> => group.with(dataSet as any);