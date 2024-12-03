import { Component, createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { selectable, SelectionProvider, useSelection } from "~/features/selectable";
import css from './table.module.css';

selectable

type Row<T> = { kind: 'row', key: string, value: T }
type Group<T> = { kind: 'group', key: string, nodes: Node<T>[] };
type Node<T> = Row<T> | Group<T>;

export function Table<T extends Record<string, any>>(props: { class?: string, rows: T[], selectable?: boolean }) {
    const [selection, setSelection] = createSignal<object[]>([]);
    const columns = createMemo(() => ['#', ...Object.keys(props.rows.at(0) ?? {})]);
    const selectable = createMemo(() => props.selectable ?? false);

    return <>
        <SelectionProvider selection={setSelection} multiSelect>
            {/* <Api api={props.api} /> */}

            <_Table class={props.class} columns={columns()} rows={props.rows} />
        </SelectionProvider>
    </>;
};

type TableProps<T extends Record<string, any>> = { class?: string, columns: (keyof T)[], rows: T[] };

function _Table<T extends Record<string, any>>(props: TableProps<T>) {
    const columnCount = createMemo(() => props.columns.length - 1);
    const nodes = createMemo<Node<T>[]>(() => {
        const rows = Object.entries(props.rows).map<Row<T>>(([i, row]) => ({ kind: 'row', key: row['key'], value: row }));

        const group = (nodes: Row<T>[]): Node<T>[] => nodes.every(n => n.key.includes('.') === false)
            ? nodes
            : Object.entries(Object.groupBy(nodes, r => String(r.key).split('.').at(0)!))
                .map<Group<T>>(([key, nodes]) => ({ kind: 'group', key, nodes: group(nodes!.map(n => ({ ...n, key: n.key.slice(key.length + 1) }))) }));

        const grouped = group(rows);

        return grouped;
    });

    return <section class={`${css.table} ${props.class}`} style={{ '--columns': columnCount() }}>
        <Head headers={props.columns} />

        <main class={css.main}>
            <For each={nodes()}>{
                node => <Node node={node} depth={0} />
            }</For>

        </main>
    </section>
};

function Head<T extends Record<string, any>>(props: { headers: (keyof T)[] }) {
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
            header => <span class={css.cell}>{header.toString()}</span>
        }</For>
    </header>;
};

function Node<T extends Record<string, any>>(props: { node: Node<T>, depth: number }) {
    return <Switch>
        <Match when={props.node.kind === 'row' ? props.node : undefined}>{
            row => <Row key={row().key} value={row().value} depth={props.depth} />
        }</Match>

        <Match when={props.node.kind === 'group' ? props.node : undefined}>{
            group => <Group key={group().key} nodes={group().nodes} depth={props.depth} />
        }</Match>
    </Switch>;
}

function Row<T extends Record<string, any>>(props: { key: string, value: T, depth: number }) {
    const context = useSelection();

    const values = createMemo(() => Object.entries(props.value));
    const isSelected = context.isSelected(props.key);

    return <div class={css.row} use:selectable={{ value: props.value, key: props.key }}>
        <div class={css.cell}>
            <input type="checkbox" checked={isSelected()} on:input={() => context.select([props.key])} on:pointerdown={e => e.stopPropagation()} />
        </div>

        <div class={css.cell}>
            <span style={{ '--depth': props.depth }}>{props.key}</span>
        </div>

        <For each={values()}>{
            ([k, v]) => <div class={css.cell}>{v}</div>
        }</For>
    </div>;
};

function Group<T extends Record<string, any>>(props: { key: string, nodes: Node<T>[], depth: number }) {
    return <details open>
        <summary style={{ '--depth': props.depth }}>{props.key}</summary>

        <For each={props.nodes}>{
            node => <Node node={node} depth={props.depth + 1} />
        }</For>
    </details>;
};