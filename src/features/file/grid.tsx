import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, onMount, ParentComponent, Show, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { SelectionProvider, useSelection, selectable } from "../selectable";
import css from './grid.module.css';

selectable // prevents removal of import

const debounce = <T extends (...args: any[]) => void>(callback: T, delay: number): T => {
    let handle: ReturnType<typeof setTimeout> | undefined;

    return (...args: any[]) => {
        if (handle) {
            clearTimeout(handle);
        }

        handle = setTimeout(() => callback(...args), delay);
    }
};

interface Leaf extends Record<string, string> { }
export interface Entry extends Record<string, Entry | Leaf> { }

type Rows = Record<string, { [lang: string]: { original: string, value: string } }>;

export interface GridContextType {
    readonly rows: Accessor<Rows>;
    readonly selection: Accessor<object[]>;
    mutate(prop: string, lang: string, value: string): void;
}

export interface GridApi {
    readonly rows: Accessor<Rows>;
    selectAll(): void;
    clear(): void;
}

const GridContext = createContext<GridContextType>();

const isLeaf = (entry: Entry | Leaf): entry is Leaf => Object.values(entry).some(v => typeof v === 'string');
const useGrid = () => useContext(GridContext)!;

const GridProvider: ParentComponent<{ rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }> }> = (props) => {
    const [selection, setSelection] = createSignal<object[]>([]);
    const [state, setState] = createStore<{ rows: Rows, numberOfRows: number }>({
        rows: {},
        numberOfRows: 0,
    });

    createEffect(() => {
        const rows = props.rows
            .entries()
            .map(([prop, entry]) => [prop, Object.fromEntries(Object.entries(entry).map(([lang, { value }]) => [lang, { original: value, value }]))]);

        setState('rows', Object.fromEntries(rows));
    });

    createEffect(() => {
        setState('numberOfRows', Object.keys(state.rows).length);
    });

    const ctx: GridContextType = {
        rows: createMemo(() => state.rows),
        selection,

        mutate(prop: string, lang: string, value: string) {
            setState('rows', produce(rows => {
                rows[prop][lang].value = value;
            }));
        },
    };

    const mutated = createMemo(() => Object.values(state.rows).filter(entry => Object.values(entry).some(lang => lang.original !== lang.value)));

    return <GridContext.Provider value={ctx}>
        <SelectionProvider selection={setSelection} multiSelect>
            {props.children}
        </SelectionProvider>
    </GridContext.Provider>;
};

export const Grid: Component<{ class?: string, columns: string[], rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>, api?: (api: GridApi) => any }> = (props) => {
    const columnCount = createMemo(() => props.columns.length - 1);
    const root = createMemo<Entry>(() => {
        return props.rows
            ?.entries()
            .map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([lang, { value }]) => [lang, value]))] as const)
            .reduce((aggregate, [key, entry]) => {
                let obj: any = aggregate;
                const parts = key.split('.');

                for (const [i, part] of parts.entries()) {
                    if (Object.hasOwn(obj, part) === false) {
                        obj[part] = {};
                    }

                    if (i === (parts.length - 1)) {
                        obj[part] = entry;
                    }
                    else {
                        obj = obj[part];
                    }
                }

                return aggregate;
            }, {});
    });

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
    const selectionContext = useSelection();

    const api: GridApi = {
        rows: gridContext.rows,
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
                        <input type="checkbox" checked={isSelected()} oninput={() => context.select([k], { append: true })} />
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
    let element: HTMLTextAreaElement;

    const resize = () => {
        element.style.height = `1px`;
        element.style.height = `${11 + element.scrollHeight}px`;
    };

    const mutate = debounce(() => {
        props.oninput?.(new InputEvent('input', {
            data: element.value.trim(),
        }))
    }, 300);

    const onKeyUp = (e: KeyboardEvent) => {
        resize();
        mutate();
    };

    onMount(() => {
        resize();
    });

    return <textarea
        ref={element}
        value={props.value}
        lang={props.lang}
        placeholder={props.lang}
        name={`${props.key}:${props.lang}`}
        spellcheck
        wrap="soft"
        onkeyup={onKeyUp}
    />
};