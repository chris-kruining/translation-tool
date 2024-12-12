import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, ParentComponent, Show, useContext } from "solid-js";
import { createStore, produce, unwrap } from "solid-js/store";
import { debounce, deepCopy, deepDiff, Mutation, splitAt } from "~/utilities";
import { DataSetRowNode, DataSetNode, SelectionMode, Table } from "~/components/table";
import css from './grid.module.css';

type Rows = Map<string, Record<string, string>>;

export interface GridContextType {
    readonly rows: Accessor<Rows>;
    readonly mutations: Accessor<Mutation[]>;
    // readonly selection: Accessor<SelectionItem[]>;
    mutate(prop: string, value: string): void;
    remove(props: string[]): void;
    insert(prop: string): void;
    addColumn(name: string): void;
}

export interface GridApi {
    readonly selection: Accessor<Record<string, Record<string, string>>>;
    readonly rows: Accessor<Record<string, Record<string, string>>>;
    readonly mutations: Accessor<Mutation[]>;
    selectAll(): void;
    clear(): void;
    remove(keys: string[]): void;
    insert(prop: string): void;
    addColumn(name: string): void;
}

const GridContext = createContext<GridContextType>();

const useGrid = () => useContext(GridContext)!;

export const Grid: Component<{ class?: string, columns: string[], rows: Rows, api?: (api: GridApi) => any }> = (props) => {
    const [table, setTable] = createSignal();
    const [state, setState] = createStore<{ rows: Record<string, Record<string, string>>, columns: string[], snapshot: Rows, numberOfRows: number }>({
        rows: {},
        columns: [],
        snapshot: new Map,
        numberOfRows: 0,
    });

    const mutations = createMemo(() => {
        // enumerate all values to make sure the memo is recalculated on any change
        Object.values(state.rows).map(entry => Object.values(entry));

        return deepDiff(state.snapshot, state.rows).toArray();
    });

    type Entry = { key: string, [lang: string]: string };

    const groupBy = (rows: DataSetRowNode<Entry>[]) => {
        const group = (nodes: DataSetRowNode<Entry>[]): DataSetNode<Entry>[] => Object
            .entries(Object.groupBy(nodes, r => r.key.split('.').at(0)!) as Record<string, DataSetRowNode<Entry>[]>)
            .map<DataSetNode<Entry>>(([key, nodes]) => nodes.at(0)?.key === key
                ? { ...nodes[0], key: nodes[0].value.key, value: { ...nodes[0].value, key: nodes[0].key } }
                : ({ kind: 'group', key, groupedBy: 'key', nodes: group(nodes.map(n => ({ ...n, key: n.key.slice(key.length + 1) }))) })
            );

        return group(rows.map(r => ({ ...r, key: r.value.key })));
    }

    const rows = createMemo(() => Object.entries(state.rows).map(([key, values]) => ({ key, ...values })));
    const columns = createMemo(() => [
        { id: 'key', label: 'Key', groupBy },
        ...state.columns.map(c => ({ id: c, label: c })),
    ]);

    createEffect(() => {
        setState('rows', Object.fromEntries(deepCopy(props.rows).entries()));
        setState('snapshot', props.rows);
    });

    createEffect(() => {
        setState('columns', [...props.columns]);
    });

    createEffect(() => {
        setState('numberOfRows', Object.keys(state.rows).length);
    });

    const ctx: GridContextType = {
        rows,
        mutations,
        // selection,

        mutate(prop: string, value: string) {
            const [key, lang] = splitAt(prop, prop.lastIndexOf('.'));

            setState('rows', key, lang, value);
        },

        remove(props: string[]) {
            setState('rows', produce(rows => {
                for (const prop of props) {
                    delete rows[prop];
                }

                return rows;
            }));
        },

        insert(prop: string) {
            setState('rows', prop, Object.fromEntries(state.columns.map(lang => [lang, ''])));
        },

        addColumn(name: string): void {
            if (state.columns.includes(name)) {
                return;
            }

            setState(produce(state => {
                state.columns.push(name);
                state.rows = Object.fromEntries(Object.entries(state.rows).map(([key, row]) => [key, { ...row, [name]: '' }]));

                return state;
            }))
        },
    };

    return <GridContext.Provider value={ctx}>
        <Api api={props.api} table={table()} />

        <Table api={setTable} class={props.class} rows={rows()} columns={columns()} groupBy="key" selectionMode={SelectionMode.Multiple}>{
            Object.fromEntries(state.columns.map(c => [c, ({ key, value }: any) => {
                return <TextArea key={key} value={value} oninput={(e) => ctx.mutate(key, e.data ?? '')} />;
            }]))
        }</Table>
    </GridContext.Provider>;
};

const Api: Component<{ api: undefined | ((api: GridApi) => any), table?: any }> = (props) => {
    const gridContext = useGrid();

    const api = createMemo<GridApi | undefined>(() => {
        const table = props.table;

        if (!table) {
            return;
        }

        return {
            selection: createMemo(() => {
                const selection = props.table?.selection() ?? [];

                return Object.fromEntries(selection.map(({ key, value }) => [key, value()] as const));
            }),
            rows: createMemo(() => props.table?.rows ?? []),
            mutations: gridContext.mutations,
            selectAll() {
                props.table.selectAll();
            },
            clear() {
                props.table.clear();
            },
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

const TextArea: Component<{ key: string, value: string, oninput?: (event: InputEvent) => any }> = (props) => {
    const [element, setElement] = createSignal<HTMLTextAreaElement>();
    const key = createMemo(() => props.key.slice(0, props.key.lastIndexOf('.')));
    const lang = createMemo(() => props.key.slice(props.key.lastIndexOf('.') + 1));

    const resize = () => {
        const el = element();

        if (!el) {
            return;
        }

        el.style.height = `1px`;
        el.style.height = `${2 + element()!.scrollHeight}px`;
    };

    const mutate = debounce(() => {
        props.oninput?.(new InputEvent('input', {
            data: element()?.value.trim(),
        }))
    }, 300);

    const onKeyUp = (e: KeyboardEvent) => {
        resize();
        mutate();
    };

    return <textarea
        ref={setElement}
        value={props.value}
        lang={lang()}
        placeholder={`${key()} in ${lang()}`}
        name={`${key()}:${lang()}`}
        spellcheck={true}
        wrap="soft"
        onkeyup={onKeyUp}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />
};