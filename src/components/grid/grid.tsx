import { Accessor, createContext, createEffect, createMemo, createSignal, JSX, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { deepCopy, deepDiff, Mutation } from "~/utilities";
import { SelectionMode, Table, Column as TableColumn, TableApi } from "~/components/table";
import css from './grid.module.css';

export interface Column<T extends Record<string, any>> extends TableColumn<T> {
    editor?: (cell: { id: keyof T, value: T[keyof T] }) => JSX.Element;
}

export interface GridApi<T extends Record<string, any>> extends TableApi<T> {
    readonly mutations: Accessor<Mutation[]>;
    remove(keys: string[]): void;
    insert(prop: string): void;
    addColumn(name: string): void;
}

interface GridContextType<T extends Record<string, any>> {
    readonly rows: Accessor<T[]>;
    readonly mutations: Accessor<Mutation[]>;
    // readonly selection: Accessor<SelectionItem[]>;
    mutate(prop: string, value: string): void;
    remove(props: string[]): void;
    insert(prop: string): void;
    addColumn(name: string): void;
}

const GridContext = createContext<GridContextType<any>>();

const useGrid = () => useContext(GridContext)!;

type GridProps<T extends Record<string, any>> = { class?: string, groupBy?: keyof T, columns: Column<T>[], rows: T[], api?: (api: GridApi<T>) => any };

export function Grid<T extends Record<string, any>>(props: GridProps<T>) {
    const [table, setTable] = createSignal<TableApi<T>>();
    const [state, setState] = createStore<{ rows: T[], columns: Column<T>[], snapshot: T[], numberOfRows: number }>({
        rows: [],
        columns: [],
        snapshot: [],
        numberOfRows: 0,
    });

    const mutations = createMemo(() => {
        // enumerate all values to make sure the memo is recalculated on any change
        Object.values(state.rows).map(entry => Object.values(entry));

        return deepDiff(state.snapshot, state.rows).toArray();
    });

    createEffect(() => {
        setState('rows', Object.fromEntries(deepCopy(props.rows).entries()));
        setState('snapshot', props.rows);
    });

    createEffect(() => {
        setState('columns', props.columns);
    });

    createEffect(() => {
        setState('numberOfRows', Object.keys(state.rows).length);
    });

    const rows = createMemo(() => state.rows);
    const columns = createMemo(() => state.columns);

    const ctx: GridContextType<T> = {
        rows,
        mutations,
        // selection,

        mutate(prop: string, value: string) {
        },

        remove(props: string[]) {
        },

        insert(prop: string) {
        },

        addColumn(id: keyof T): void {
        },
    };

    const cellEditors = createMemo(() => Object.fromEntries(state.columns.filter(c => c.editor !== undefined).map(c => [c.id, c.editor!] as const)));

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
            remove(props: string[]) {
                gridContext.remove(props);
            },
            insert(prop: string) {
                gridContext.insert(prop);
            },
            addColumn(name: string): void {
                gridContext.addColumn(name);
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