import { Accessor, createContext, createEffect, createMemo, createSignal, JSX, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { deepCopy, deepDiff, Mutation } from "~/utilities";
import { SelectionMode, Table, Column as TableColumn, TableApi, CellEditors, CellEditor, createDataSet, DataSet, DataSetNode } from "~/components/table";
import css from './grid.module.css';

export interface Column<T extends Record<string, any>> extends TableColumn<T> {
    editor?: (cell: { row: number, column: keyof T, value: T[keyof T], mutate: (next: T[keyof T]) => any }) => JSX.Element;
}

export interface GridApi<T extends Record<string, any>> extends TableApi<T> {
    readonly mutations: Accessor<Mutation[]>;
    remove(keys: number[]): void;
    insert(row: T, at?: number): void;
    addColumn(column: keyof T): void;
}

interface GridContextType<T extends Record<string, any>> {
    readonly rows: Accessor<DataSetNode<keyof T, T>[]>;
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: TableApi<T>['selection'];
    mutate<K extends keyof T>(row: number, column: K, value: T[K]): void;
    remove(rows: number[]): void;
    insert(row: T, at?: number): void;
    addColumn(column: keyof T, value: T[keyof T]): void;
}

const GridContext = createContext<GridContextType<any>>();

const useGrid = () => useContext(GridContext)!;

type GridProps<T extends Record<string, any>> = { class?: string, groupBy?: keyof T, columns: Column<T>[], rows: T[], api?: (api: GridApi<T>) => any };
// type GridState<T extends Record<string, any>> = { data: DataSet<T>, columns: Column<T>[], numberOfRows: number };

export function Grid<T extends Record<string, any>>(props: GridProps<T>) {
    const [table, setTable] = createSignal<TableApi<T>>();
    const data = createMemo(() => createDataSet(props.rows));

    const rows = createMemo(() => data().value());
    const mutations = createMemo(() => data().mutations());
    const columns = createMemo(() => props.columns);

    const ctx: GridContextType<T> = {
        rows,
        mutations,
        selection: createMemo(() => table()?.selection() ?? []),

        mutate<K extends keyof T>(row: number, column: K, value: T[K]) {
            data().mutate(row, column, value);
        },

        remove(rows: number[]) {
            // setState('rows', (r) => r.filter((_, i) => rows.includes(i) === false));
        },

        insert(row: T, at?: number) {
            if (at === undefined) {
                // setState('rows', state.rows.length, row);
            } else {

            }
        },

        addColumn(column: keyof T, value: T[keyof T]): void {
            // setState('rows', { from: 0, to: state.rows.length - 1 }, column as any, value);
        },
    };

    const cellEditors = createMemo(() => Object.fromEntries(
        props.columns
            .filter(c => c.editor !== undefined)
            .map(c => {
                const Editor: CellEditor<T, keyof T> = ({ row, column, value }) => {
                    const mutate = (next: T[keyof T]) => {
                        console.log('KAAS', { next })

                        ctx.mutate(row, column, next);
                    };

                    return c.editor!({ row, column, value, mutate });
                };

                return [c.id, Editor] as const;
            })
    ) as any);

    return <GridContext.Provider value={ctx}>
        <Api api={props.api} table={table()} />

        <form style="all: inherit; display: contents;">
            <Table api={setTable} class={`${css.grid} ${props.class}`} rows={data()} columns={columns()} selectionMode={SelectionMode.Multiple}>{
                cellEditors()
            }</Table>
        </form>
    </GridContext.Provider>;
};

function Api<T extends Record<string, any>>(props: { api: undefined | ((api: GridApi<T>) => any), table?: TableApi<T> }) {
    const gridContext = useGrid();

    const api = createMemo<GridApi<T> | undefined>(() => {
        const table = props.table;

        if (!table) {
            return;
        }

        return {
            ...table,
            mutations: gridContext.mutations,
            remove(rows: number[]) {
                gridContext.remove(rows);
            },
            insert(row: T, at?: number) {
                gridContext.insert(row, at);
            },
            addColumn(column: keyof T, value: T[keyof T]): void {
                gridContext.addColumn(column, value);
            },
        };
    });

    createEffect(() => {
        const value = api();

        if (value) {
            props.api?.(value);
        }
    });

    return null;
};