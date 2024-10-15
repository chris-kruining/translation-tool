import { Component, createContext, createEffect, createMemo, For, ParentComponent, Show, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";
import './grid.css';

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

export interface SelectionContextType {
    rowCount(): number;
    selection(): string[];
    isSelected(key: string): boolean,
    selectAll(select: boolean): void;
    select(key: string, select: boolean): void;
}
export interface GridContextType {
    rows: Record<string, { [lang: string]: { original: string, value: string } }>;
    selection: SelectionContextType;
    mutate(prop: string, lang: string, value: string): void;
}

const SelectionContext = createContext<SelectionContextType>();
const GridContext = createContext<GridContextType>();

const isLeaf = (entry: Entry | Leaf): entry is Leaf => Object.values(entry).some(v => typeof v === 'string');
const useSelection = () => useContext(SelectionContext)!;
const useGrid = () => useContext(GridContext)!;

const SelectionProvider: ParentComponent<{ rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>, context?: (ctx: SelectionContextType) => any }> = (props) => {
    const [state, setState] = createStore<{ selection: string[] }>({ selection: [] });

    const rowKeys = createMemo(() => {
        return Array.from(props.rows?.keys());
    });

    const context = {
        rowCount() {
            return rowKeys().length;
        },
        selection() {
            return state.selection;
        },
        isSelected(key: string) {
            return state.selection.includes(key);
        },
        selectAll(selected: boolean) {
            setState('selection', selected ? rowKeys() : []);
        },
        select(key: string, select: true) {
            setState('selection', selection => {
                if (select) {
                    return [...selection, key];
                }

                return selection.toSpliced(selection.indexOf(key), 1);
            });
        },
    };

    createEffect(() => {
        props.context?.(context)
    });

    return <SelectionContext.Provider value={context}>
        {props.children}
    </SelectionContext.Provider>;
};
const GridProvider: ParentComponent<{ rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>, context?: (ctx: GridContextType) => any }> = (props) => {
    const [state, setState] = createStore<{ rows: GridContextType['rows'], numberOfRows: number }>({
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
        rows: state.rows,
        selection: undefined!,

        mutate(prop: string, lang: string, value: string) {
            setState('rows', produce(rows => {
                rows[prop][lang].value = value;
            }));
        },
    };

    createEffect(() => {
        props.context?.(ctx);
    });

    const mutated = createMemo(() => Object.values(state.rows).filter(entry => Object.values(entry).some(lang => lang.original !== lang.value)));

    createEffect(() => {
        console.log('tap', mutated());
    });

    return <GridContext.Provider value={ctx}>
        <SelectionProvider rows={props.rows} context={(selction) => ctx.selection = selction}>
            {props.children}
        </SelectionProvider>
    </GridContext.Provider>;
};

export const Grid: Component<{ columns: string[], rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>, context?: (ctx: GridContextType) => any }> = (props) => {
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

    return <section class="table" style={{ '--columns': columnCount() }}>
        <GridProvider rows={props.rows} context={props.context}>
            <Head headers={props.columns} />

            <main>
                <Row entry={root()} />
            </main>
        </GridProvider>
    </section>
};

const Head: Component<{ headers: string[] }> = (props) => {
    const context = useSelection();

    return <header>
        <div class="cell">
            <input
                type="checkbox"
                checked={context.selection().length > 0 && context.selection().length === context.rowCount()}
                indeterminate={context.selection().length !== 0 && context.selection().length !== context.rowCount()}
                on:input={(e: InputEvent) => context.selectAll(e.target.checked)}
            />
        </div>

        <For each={props.headers}>{
            header => <span class="cell">{header}</span>
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

            const resize = (element: HTMLElement) => {
                element.style.blockSize = `1px`;
                element.style.blockSize = `${11 + element.scrollHeight}px`;
            };

            const mutate = debounce((element: HTMLTextAreaElement) => {
                const [prop, lang] = element.name.split(':');

                grid.mutate(prop, lang, element.value.trim())
            }, 300);

            const onKeyUp = (e: KeyboardEvent) => {
                const element = e.target as HTMLTextAreaElement;

                resize(element);
                mutate(element);
            };

            return <Show when={isLeaf(value)} fallback={<Group key={key} entry={value as Entry} path={path} />}>
                <label for={k}>
                    <div class="cell">
                        <input type="checkbox" id={k} checked={context.isSelected(k)} on:input={(e) => context.select(k, e.target.checked)} />
                    </div>

                    <div class="cell">
                        <span style={{ '--depth': path.length - 1 }}>{key}</span>
                    </div>

                    <For each={values}>{
                        ([lang, value]) => <div class="cell">
                            <textarea
                                value={value}
                                lang={lang}
                                placeholder={lang}
                                name={`${k}:${lang}`}
                                spellcheck
                                wrap="soft"
                                on:keyup={onKeyUp}
                            />
                        </div>
                    }</For>
                </label>
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