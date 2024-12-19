import { Accessor, Component, createEffect, createMemo, createSignal } from "solid-js";
import { debounce, Mutation } from "~/utilities";
import { Column, GridApi as GridCompApi, Grid as GridComp } from "~/components/grid";
import { createDataSet, DataSetNode, DataSetRowNode } from "~/components/table";
import { SelectionItem } from "../selectable";
import css from "./grid.module.css"

export type Entry = { key: string } & { [lang: string]: string };
export interface GridApi {
    readonly mutations: Accessor<Mutation[]>;
    readonly selection: Accessor<SelectionItem<number, Entry>[]>;
    remove(indices: number[]): void;
    addKey(key: string): void;
    addLocale(locale: string): void;
};

const groupBy = (rows: DataSetRowNode<number, Entry>[]) => {
    type R = DataSetRowNode<number, Entry> & { _key: string };

    const group = (nodes: R[]): DataSetNode<number, Entry>[] => Object
        .entries(Object.groupBy(nodes, r => r._key.split('.').at(0)!) as Record<number, R[]>)
        .map<any>(([key, nodes]) => nodes.at(0)?._key === key
            ? nodes[0]
            : ({ kind: 'group', key, groupedBy: 'key', nodes: group(nodes.map(n => ({ ...n, _key: n._key.slice(key.length + 1) }))) })
        );

    return group(rows.map<R>(r => ({ ...r, _key: r.value.key }))) as any;
}

export function Grid(props: { class?: string, rows: Entry[], locales: string[], api?: (api: GridApi) => any }) {
    const rows = createMemo(() => createDataSet<Entry>(props.rows, { group: { by: 'key', with: groupBy } }));
    const locales = createMemo(() => props.locales);
    const columns = createMemo<Column<Entry>[]>(() => [
        {
            id: 'key',
            label: 'Key',
            renderer: ({ value }) => value.split('.').at(-1),
        },
        ...locales().map<Column<Entry>>(lang => ({
            id: lang,
            label: lang,
            renderer: ({ row, column, value, mutate }) => {
                const entry = rows().value[row]!;

                return <TextArea row={row} key={entry.key} lang={String(column)} value={value} oninput={e => mutate(e.data ?? '')} />;
            },
        }))
    ]);

    const [api, setApi] = createSignal<GridCompApi<Entry>>();

    createEffect(() => {
        const r = rows();

        props.api?.({
            mutations: r.mutations,
            selection: createMemo(() => api()?.selection() ?? []),
            remove: r.remove,
            addKey(key) {
                r.insert({ key, ...Object.fromEntries(locales().map(l => [l, ''])) });
            },
            addLocale(locale) {
                r.mutateEach(entry => ({ ...entry, [locale]: '' }));
            },
        });
    });

    return <GridComp rows={rows()} columns={columns()} api={setApi} />;
};

const TextArea: Component<{ row: number, key: string, lang: string, value: string, oninput?: (event: InputEvent) => any }> = (props) => {
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
        class={css.textarea}
        value={props.value}
        lang={props.lang}
        placeholder={`${props.key} in ${props.lang}`}
        name={`${props.row}[${props.lang}]`}
        spellcheck={true}
        wrap="soft"
        onkeyup={onKeyUp}
        on:keydown={e => e.stopPropagation()}
        on:pointerdown={e => e.stopPropagation()}
    />
};