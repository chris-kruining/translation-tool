import { Accessor, createContext, createEffect, createMemo, createSignal, For, JSX, Match, Show, Switch, useContext } from "solid-js";
import { selectable, SelectionProvider, useSelection } from "~/features/selectable";
import { type RowNode, type GroupNode, type Node, createDataSet, toSorted, toGrouped } from './dataset';
import css from './table.module.css';
import { createStore } from "solid-js/store";
import { FaSolidSort, FaSolidSortDown, FaSolidSortUp } from "solid-icons/fa";

selectable

export type Column<T> = {
    id: keyof T,
    label: string,
    sortable?: boolean,
    readonly groupBy?: (rows: RowNode<T>[]) => Node<T>[],
};

const TableContext = createContext<{
    readonly columns: Accessor<Column<any>[]>,
    readonly selectionMode: Accessor<SelectionMode>,
    readonly groupBy: Accessor<string | undefined>,
    readonly sort: Accessor<{ by: string, reversed?: boolean } | undefined>,
    readonly cellRenderers: Accessor<Record<string, (cell: { value: any }) => JSX.Element>>,

    setSort(setter: (current: { by: string, reversed?: boolean } | undefined) => { by: string, reversed: boolean } | undefined): void;
}>();

const useTable = () => useContext(TableContext)!

function defaultGroupingFunction<T>(groupBy: keyof T) {
    return (nodes: RowNode<T>[]): Node<T>[] => Object.entries(Object.groupBy<any, RowNode<T>>(nodes, r => r.value[groupBy]))
        .map<GroupNode<T>>(([key, nodes]) => ({ kind: 'group', key, groupedBy: groupBy, nodes: nodes! }));
}

export enum SelectionMode {
    None,
    Single,
    Multiple
}
type TableProps<T extends Record<string, any>> = {
    class?: string,
    rows: T[],
    columns: Column<T>[],
    groupBy?: keyof T,
    sort?: {
        by: keyof T,
        reversed?: boolean,
    },
    selectionMode?: SelectionMode,
    children?: { [K in keyof T]?: (cell: { value: T[K] }) => JSX.Element },
};

export function Table<T extends Record<string, any>>(props: TableProps<T>) {
    const [selection, setSelection] = createSignal<object[]>([]);

    const [state, setState] = createStore({
        sort: props.sort ? { by: props.sort.by as string, reversed: props.sort.reversed } : undefined,
    });

    createEffect(() => {
        setState('sort', props.sort ? { by: props.sort.by as string, reversed: props.sort.reversed } : undefined);
    });

    const columns = createMemo<Column<T>[]>(() => props.columns ?? []);
    const selectionMode = createMemo(() => props.selectionMode ?? SelectionMode.None);
    const groupBy = createMemo(() => props.groupBy as string | undefined);
    const cellRenderers = createMemo(() => props.children ?? {});

    const context = {
        columns,
        selectionMode,
        groupBy,
        sort: createMemo(() => state.sort),
        cellRenderers,

        setSort(setter: (current: { by: string, reversed?: boolean } | undefined) => { by: string, reversed: boolean } | undefined) {
            setState('sort', setter);
        },
    };

    return <TableContext.Provider value={context}>
        <SelectionProvider selection={setSelection} multiSelect>
            <InnerTable class={props.class} rows={props.rows} />
        </SelectionProvider>
    </TableContext.Provider>;
};

type InnerTableProps<T extends Record<string, any>> = { class?: string, rows: T[] };

function InnerTable<T extends Record<string, any>>(props: InnerTableProps<T>) {
    const table = useTable();

    const selectable = createMemo(() => table.selectionMode() !== SelectionMode.None);
    const columnCount = createMemo(() => table.columns().length);
    const nodes = createMemo<Node<T>[]>(() => {
        const columns = table.columns();
        const groupBy = table.groupBy();
        const sort = table.sort();

        let dataset = createDataSet(props.rows);

        if (sort) {
            dataset = toSorted(dataset, { by: sort.by, reversed: sort.reversed ?? false, with: (a, b) => a < b ? -1 : a > b ? 1 : 0 })
        }

        if (groupBy) {
            dataset = toGrouped(dataset, { by: groupBy, with: columns.find(({ id }) => id === groupBy)?.groupBy ?? defaultGroupingFunction(groupBy) });
        }

        return dataset;
    });

    return <section class={`${css.table} ${selectable() ? css.selectable : ''} ${props.class}`} style={{ '--columns': columnCount() }}>
        <Head />

        <main class={css.main}>
            <For each={nodes()}>{
                node => <Node node={node} depth={0} />
            }</For>

        </main>
    </section>
};

function Head<T extends Record<string, any>>(props: {}) {
    const table = useTable();
    const context = useSelection();

    return <header class={css.header}>
        <Show when={table.selectionMode() !== SelectionMode.None}>
            <aside>
                <input
                    type="checkbox"
                    checked={context.selection().length > 0 && context.selection().length === context.length()}
                    indeterminate={context.selection().length !== 0 && context.selection().length !== context.length()}
                    on:input={(e: InputEvent) => e.target.checked ? context.selectAll() : context.clear()}
                />
            </aside>
        </Show>

        <For each={table.columns()}>{
            ({ id, label, sortable }) => {
                const sort = createMemo(() => table.sort());
                const by = String(id);

                const onPointerDown = (e: PointerEvent) => {
                    if (sortable !== true) {
                        return;
                    }

                    table.setSort(current => {
                        if (current?.by !== by) {
                            return { by, reversed: false };
                        }

                        if (current.reversed === true) {
                            return undefined;
                        }

                        return { by, reversed: true };
                    });
                };

                return <span class={`${css.cell} ${sort()?.by === by ? css.sorted : ''}`} onpointerdown={onPointerDown}>
                    {label}

                    <Switch>
                        <Match when={sortable && sort()?.by !== by}><FaSolidSort /></Match>
                        <Match when={sortable && sort()?.by === by && sort()?.reversed !== true}><FaSolidSortUp /></Match>
                        <Match when={sortable && sort()?.by === by && sort()?.reversed === true}><FaSolidSortDown /></Match>
                    </Switch>
                </span>;
            }
        }</For>
    </header>;
};

function Node<T extends Record<string, any>>(props: { node: Node<T>, depth: number, groupedBy?: keyof T }) {
    return <Switch>
        <Match when={props.node.kind === 'row' ? props.node : undefined}>{
            row => <Row key={row().key} value={row().value} depth={props.depth} groupedBy={props.groupedBy} />
        }</Match>

        <Match when={props.node.kind === 'group' ? props.node : undefined}>{
            group => <Group key={group().key} groupedBy={group().groupedBy} nodes={group().nodes} depth={props.depth} />
        }</Match>
    </Switch>;
}

function Row<T extends Record<string, any>>(props: { key: string, value: T, depth: number, groupedBy?: keyof T }) {
    const table = useTable();
    const context = useSelection();

    const values = createMemo(() => Object.entries(props.value));
    const isSelected = context.isSelected(props.key);

    return <div class={css.row} style={{ '--depth': props.depth }} use:selectable={{ value: props.value, key: props.key }}>
        <Show when={table.selectionMode() !== SelectionMode.None}>
            <aside>
                <input type="checkbox" checked={isSelected()} on:input={() => context.select([props.key])} on:pointerdown={e => e.stopPropagation()} />
            </aside>
        </Show>

        <For each={values()}>{
            ([k, v]) => <div class={css.cell}>{table.cellRenderers()[k]?.({ value: v }) ?? v}</div>
        }</For>
    </div>;
};

function Group<T extends Record<string, any>>(props: { key: string, groupedBy: keyof T, nodes: Node<T>[], depth: number }) {
    const table = useTable();

    return <details open>
        <summary style={{ '--depth': props.depth }}>{props.key}</summary>

        <For each={props.nodes}>{
            node => <Node node={node} depth={props.depth + 1} groupedBy={props.groupedBy} />
        }</For>
    </details>;
};