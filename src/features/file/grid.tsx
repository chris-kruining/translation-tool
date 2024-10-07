import { Accessor, Component, createContext, createEffect, createMemo, createSignal, For, ParentComponent, Show, useContext } from "solid-js";
import './grid.css';
import { createStore } from "solid-js/store";

interface Leaf extends Record<string, string> { }
export interface Entry extends Record<string, Entry | Leaf> { }

interface SelectionContextType {
    rowCount(): number;
    selection(): string[];
    isSelected(key: string): boolean,
    selectAll(select: boolean): void;
    select(key: string, select: true): void;
}

const SelectionContext = createContext<SelectionContextType>();

const isLeaf = (entry: Entry | Leaf): entry is Leaf => Object.values(entry).some(v => typeof v === 'string');
const useSelection = () => useContext(SelectionContext)!;

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

export const Grid: Component<{ columns: string[], rows: Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>, context?: (ctx: SelectionContextType) => any }> = (props) => {
    const columnCount = createMemo(() => props.columns.length - 1);
    const root = createMemo<Entry>(() => {
        return Object.fromEntries(props.rows.entries().map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([lang, { value }]) => [lang, value]))]));
    });

    return <section class="table" style={{ '--columns': columnCount() }}>
        <SelectionProvider rows={props.rows} context={props.context}>
            <Head headers={props.columns} />

            <main>
                <Row entry={root()} />
            </main>
        </SelectionProvider>
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
    return <For each={Object.entries(props.entry)}>{
        ([key, value]) => {
            const values = Object.values(value);
            const path = [...(props.path ?? []), key];
            const k = path.join('.');
            const context = useSelection();

            return <Show when={isLeaf(value)} fallback={<Group key={key} entry={value as Entry} path={path} />}>
                <label for={k}>
                    <div class="cell">
                        <input type="checkbox" id={k} checked={context.isSelected(k)} on:input={(e: InputEvent) => context.select(k, e.target.checked)} />
                    </div>

                    <div class="cell">
                        <span style={{ '--depth': path.length - 1 }}>{key}</span>
                    </div>

                    <For each={values}>{
                        value =>
                            <div class="cell"><textarea value={value} on:keyup={(e) => {
                                e.target.style.blockSize = `1px`;
                                e.target.style.blockSize = `${11 + e.target.scrollHeight}px`;
                            }} /></div>
                    }</For>
                </label>
            </Show>;
        }
    }</For>
};

const Group: Component<{ key: string, entry: Entry, path: string[] }> = (props) => {
    return <details open>
        <summary class="cell" style={{ '--depth': props.path.length - 1 }}>{props.key}</summary>

        <Row entry={props.entry} path={props.path} />
    </details>;
};