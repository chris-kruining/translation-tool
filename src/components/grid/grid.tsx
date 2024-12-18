import { Accessor, createContext, createEffect, createMemo, createSignal, JSX, useContext } from "solid-js";
import { Mutation } from "~/utilities";
import { SelectionMode, Table, Column as TableColumn, TableApi, DataSet, CellRenderer } from "~/components/table";
import css from './grid.module.css';

export interface CellEditor<T extends Record<string, any>, K extends keyof T> {
    (cell: Parameters<CellRenderer<T, K>>[0] & { mutate: (next: T[K]) => any }): JSX.Element;
}

export interface Column<T extends Record<string, any>> extends TableColumn<T> {
    editor?: CellEditor<T, keyof T>;
}

export interface GridApi<T extends Record<string, any>> extends TableApi<T> {
    readonly mutations: Accessor<Mutation[]>;
    remove(keys: number[]): void;
    insert(row: T, at?: number): void;
    addColumn(column: keyof T): void;
}

interface GridContextType<T extends Record<string, any>> {
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: TableApi<T>['selection'];
    mutate<K extends keyof T>(row: number, column: K, value: T[K]): void;
    remove(rows: number[]): void;
    insert(row: T, at?: number): void;
    addColumn(column: keyof T, value: T[keyof T]): void;
}

const GridContext = createContext<GridContextType<any>>();

const useGrid = () => useContext(GridContext)!;

type GridProps<T extends Record<string, any>> = { class?: string, groupBy?: keyof T, columns: Column<T>[], rows: DataSet<T>, api?: (api: GridApi<T>) => any };
// type GridState<T extends Record<string, any>> = { data: DataSet<T>, columns: Column<T>[], numberOfRows: number };

export function Grid<T extends Record<string, any>>(props: GridProps<T>) {
    const [table, setTable] = createSignal<TableApi<T>>();

    const rows = createMemo(() => props.rows);
    const columns = createMemo(() => props.columns);
    const mutations = createMemo(() => rows().mutations());

    const ctx: GridContextType<T> = {
        mutations,
        selection: createMemo(() => table()?.selection() ?? []),

        mutate<K extends keyof T>(row: number, column: K, value: T[K]) {
            rows().mutate(row, column, value);
        },

        remove(indices: number[]) {
            rows().remove(indices);
            table()?.clear();
        },

        insert(row: T, at?: number) {
            rows().insert(row, at);
        },

        addColumn(column: keyof T, value: T[keyof T]): void {
            // setState('rows', { from: 0, to: state.rows.length - 1 }, column as any, value);
        },
    };

    const cellEditors = createMemo(() => Object.fromEntries(
        props.columns
            .filter(c => c.editor !== undefined)
            .map(c => {
                const Editor: CellRenderer<T, keyof T> = ({ row, column, value }) => {
                    const mutate = (next: T[keyof T]) => {
                        ctx.mutate(row, column, next);
                    };

                    return c.editor!({ row, column, value, mutate });
                };

                return [c.id, Editor] as const;
            })
    ) as any);

    return <GridContext.Provider value={ctx}>
        <Api api={props.api} table={table()} />

        <Table api={setTable} class={`${css.grid} ${props.class}`} rows={rows()} columns={columns()} selectionMode={SelectionMode.Multiple}>{
            cellEditors()
        }</Table>
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
            addColumn(column: keyof T): void {
                // gridContext.addColumn(column, value);
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