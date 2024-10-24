import { Accessor, Component, createContext, createEffect, createMemo, createRenderEffect, createSignal, createUniqueId, For, onMount, ParentComponent, Show, useContext } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { SelectionProvider, useSelection, selectable } from "../selectable";
import { debounce, deepCopy, deepDiff, Mutation } from "~/utilities";
import css from './grid.module.css';

selectable // prevents removal of import

interface Leaf extends Record<string, string> { }
export interface Entry extends Record<string, Entry | Leaf> { }

type Rows = Map<string, Record<string, string>>;
type SelectionItem = { key: string, value: Accessor<Record<string, string>>, element: WeakRef<HTMLElement> };

export interface GridContextType {
    readonly rows: Accessor<Record<string, Record<string, string>>>;
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: Accessor<SelectionItem[]>;
    mutate(prop: string, lang: string, value: string): void;
}

export interface GridApi {
    readonly selection: Accessor<Record<string, Record<string, string>>>;
    readonly rows: Accessor<Record<string, Record<string, string>>>;
    readonly mutations: Accessor<Mutation[]>;
    selectAll(): void;
    clear(): void;
}

const GridContext = createContext<GridContextType>();

const isLeaf = (entry: Entry | Leaf): entry is Leaf => Object.values(entry).some(v => typeof v === 'string');
const useGrid = () => useContext(GridContext)!;

const GridProvider: ParentComponent<{ rows: Rows }> = (props) => {
    const [selection, setSelection] = createSignal<SelectionItem[]>([]);
    const [state, setState] = createStore<{ rows: Record<string, Record<string, string>>, snapshot: Rows, numberOfRows: number }>({
        rows: {},
        snapshot: new Map,
        numberOfRows: 0,
    });

    const mutations = createMemo(() => deepDiff(state.snapshot, state.rows).toArray());
    const rows = createMemo(() => Object.fromEntries(Object.entries(state.rows).map(([key, row]) => [key, unwrap(row)] as const)));

    createEffect(() => {
        setState('rows', Object.fromEntries(deepCopy(props.rows).entries()));
        setState('snapshot', props.rows);
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
    };

    return <GridContext.Provider value={ctx}>
        <SelectionProvider selection={setSelection} multiSelect>
            {props.children}
        </SelectionProvider>
    </GridContext.Provider>;
};

export const Grid: Component<{ class?: string, columns: string[], rows: Rows, api?: (api: GridApi) => any }> = (props) => {
    const columnCount = createMemo(() => props.columns.length - 1);
    const root = createMemo<Entry>(() => props.rows
        ?.entries()
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
        <GridProvider rows={props.rows}>
            <Api api={props.api} />

            <Head headers={props.columns} />

            <main class={css.main}>
                <Row entry={root()} />
            </main>
        </GridProvider>
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

    createEffect(() => {
        props.value;

        resize();
    });

    const observer = new MutationObserver((e) => {
        if (element()?.isConnected) {
            resize();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return <textarea
        ref={setElement}
        value={props.value}
        lang={props.lang}
        placeholder={props.lang}
        name={`${props.key}:${props.lang}`}
        spellcheck
        wrap="soft"
        onkeyup={onKeyUp}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />
};