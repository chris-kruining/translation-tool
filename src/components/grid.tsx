import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, ParentComponent, Show, useContext } from "solid-js";
import { createStore, produce, unwrap } from "solid-js/store";
import { SelectionProvider, useSelection, selectable } from "../features/selectable";
import { debounce, deepCopy, deepDiff, Mutation } from "~/utilities";
import css from './grid.module.css';

selectable // prevents removal of import

type Rows = Map<string, Record<string, string>>;
type SelectionItem = { key: string, value: Accessor<Record<string, string>>, element: WeakRef<HTMLElement> };

type Insertion = { kind: 'row', key: string } | { kind: 'column', value: string };

export interface GridContextType {
    readonly rows: Accessor<Record<string, Record<string, string>>>;
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: Accessor<SelectionItem[]>;
    mutate(prop: string, lang: string, value: string): void;
    remove(props: string[]): void;
    insert(insertion: Insertion): void;
}

export interface GridApi {
    readonly selection: Accessor<Record<string, Record<string, string>>>;
    readonly rows: Accessor<Record<string, Record<string, string>>>;
    readonly mutations: Accessor<Mutation[]>;
    selectAll(): void;
    clear(): void;
    remove(keys: string[]): void;
    insert(insertion: Insertion): void;
}

const GridContext = createContext<GridContextType>();

const useGrid = () => useContext(GridContext)!;

export const Grid: Component<{ class?: string, columns: string[], rows: Rows, api?: (api: GridApi) => any }> = (props) => {
    const [selection, setSelection] = createSignal<SelectionItem[]>([]);
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
    const rows = createMemo(() => Object.fromEntries(Object.entries(state.rows).map(([key, row]) => [key, unwrap(row)] as const)));
    const columns = createMemo(() => state.columns);

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
        selection,

        mutate(prop: string, lang: string, value: string) {
            setState('rows', prop, lang, value);
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
            setState('rows', produce(rows => {
                rows[prop] = Object.fromEntries(state.columns.slice(1).map(lang => [lang, '']));

                return rows
            }))
        },

        addColumn(name: string): void {
            setState(produce(state => {
                state.columns.push(name);
                state.rows = Object.fromEntries(Object.entries(state.rows).map(([key, row]) => [key, { ...row, [name]: '' }]));

                return state;
            }))
        },
    };

    return <GridContext.Provider value={ctx}>
        <SelectionProvider selection={setSelection} multiSelect>
            <Api api={props.api} />

            <_Grid class={props.class} columns={columns()} rows={rows()} />
        </SelectionProvider>
    </GridContext.Provider>;
};

const _Grid: Component<{ class?: string, columns: string[], rows: Record<string, Record<string, string>> }> = (props) => {
    const columnCount = createMemo(() => props.columns.length - 1);
    const root = createMemo<Entry>(() => Object.entries(props.rows)
        .reduce((aggregate, [key, value]) => {
            let obj: any = aggregate;
            const parts = key.split('.');

            for (const [i, part] of parts.entries()) {
                if (Object.hasOwn(obj, part) === false) {
                    obj[part] = {};
                }

                if (i === (parts.length - 1)) {
                    obj[part] = value;
                }
                else {
                    obj = obj[part];
                }
            }

            return aggregate;
        }, {}));

    return <section class={`${css.table} ${props.class}`} style={{ '--columns': columnCount() }}>
        <Head headers={props.columns} />

        <main class={css.main}>
            <Row entry={root()} />
        </main>
    </section>
};

const Api: Component<{ api: undefined | ((api: GridApi) => any) }> = (props) => {
    const gridContext = useGrid();
    const selectionContext = useSelection<{ key: string, value: Accessor<Record<string, string>>, element: WeakRef<HTMLElement> }>();

    const api: GridApi = {
        selection: createMemo(() => {
            const selection = selectionContext.selection();

            return Object.fromEntries(selection.map(({ key, value }) => [key, value()] as const));
        }),
        rows: gridContext.rows,
        mutations: gridContext.mutations,
        selectAll() {
            selectionContext.selectAll();
        },
        clear() {
            selectionContext.clear();
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

    createEffect(() => {
        props.api?.(api);
    });

    return null;
};

const Head: Component<{ headers: string[] }> = (props) => {
    const context = useSelection();

    return <header class={css.header}>
        <div class={css.cell}>
            <input
                type="checkbox"
                checked={context.selection().length > 0 && context.selection().length === context.length()}
                indeterminate={context.selection().length !== 0 && context.selection().length !== context.length()}
                on:input={(e: InputEvent) => e.target.checked ? context.selectAll() : context.clear()}
            />
        </div>

        <For each={props.headers}>{
            header => <span class={css.cell}>{header}</span>
        }</For>
    </header>;
};

const Row: Component<{ entry: Entry, path?: string[] }> = (props) => {
    const grid = useGrid();

    return <For each={Object.entries(props.entry)}>{
        ([key, value]) => {
            const values = Object.entries(value);
            const path = [...(props.path ?? []), key];
            const k = path.join('.');
            const context = useSelection();

            const isSelected = context.isSelected(k);

            return <Show when={isLeaf(value)} fallback={<Group key={key} entry={value as Entry} path={path} />}>
                <div class={css.row} use:selectable={{ value, key: k }}>
                    <div class={css.cell}>
                        <input type="checkbox" checked={isSelected()} on:input={() => context.select([k])} on:pointerdown={e => e.stopPropagation()} />
                    </div>

                    <div class={css.cell}>
                        <span style={{ '--depth': path.length - 1 }}>{key}</span>
                    </div>

                    <For each={values}>{
                        ([lang, value]) => <div class={css.cell}>
                            <TextArea key={k} value={value} lang={lang} oninput={(e) => grid.mutate(k, lang, e.data ?? '')} />
                        </div>
                    }</For>
                </div>
            </Show>;
        }
    }</For>
};

const Group: Component<{ key: string, entry: Entry, path: string[] }> = (props) => {
    return <details open>
        <summary style={{ '--depth': props.path.length - 1 }}>{props.key}</summary>

        <Row entry={props.entry} path={props.path} />
    </details>;
};

const TextArea: Component<{ key: string, value: string, lang: string, oninput?: (event: InputEvent) => any }> = (props) => {
    const [element, setElement] = createSignal<HTMLTextAreaElement>();

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
        lang={props.lang}
        placeholder={`${props.key} in ${props.lang}`}
        name={`${props.key}:${props.lang}`}
        spellcheck={true}
        wrap="soft"
        onkeyup={onKeyUp}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />
};