import { Sidebar } from '~/components/sidebar';
import { CellEditor, Column, DataSetGroupNode, DataSetNode, DataSetRowNode, Grid, GridApi } from '~/components/grid';
import { people, Person } from './experimental.data';
import { Component, createEffect, createMemo, createSignal, For, Match, Switch } from 'solid-js';
import { debounce, MutarionKind, Mutation } from '~/utilities';
import { createDataSet, Table } from '~/components/table';
import css from './grid.module.css';

export default function GridExperiment() {
    const editor: CellEditor<any, any> = ({ value, mutate }) => <input value={value} oninput={debounce(e => mutate(e.target.value.trim()), 300)} />

    const columns: Column<Person>[] = [
        {
            id: 'id',
            label: '#',
            groupBy(rows: DataSetRowNode<Person>[]) {
                const group = (nodes: (DataSetRowNode<Person> & { _key: string })[]): DataSetNode<Person>[] => nodes.every(n => n._key.includes('.') === false)
                    ? nodes
                    : Object.entries(Object.groupBy(nodes, r => String(r._key).split('.').at(0)!))
                        .map<DataSetGroupNode<Person>>(([key, nodes]) => ({ kind: 'group', key, groupedBy: 'id', nodes: group(nodes!.map(n => ({ ...n, _key: n._key.slice(key.length + 1) }))) }));

                return group(rows.map(row => ({ ...row, _key: row.value.id })));
            },
        },
        {
            id: 'name',
            label: 'Name',
            sortable: true,
            editor,
        },
        {
            id: 'email',
            label: 'Email',
            sortable: true,
            editor,
        },
        {
            id: 'address',
            label: 'Address',
            sortable: true,
            editor,
        },
        {
            id: 'currency',
            label: 'Currency',
            sortable: true,
            editor,
        },
        {
            id: 'phone',
            label: 'Phone',
            sortable: true,
            editor,
        },
        {
            id: 'country',
            label: 'Country',
            sortable: true,
            editor,
        },
    ];

    const [api, setApi] = createSignal<GridApi<Person>>();

    const mutations = createMemo(() => api()?.mutations() ?? [])

    const rows = createDataSet(people.slice(0, 20), {
        // group: { by: 'country' },
        sort: { by: 'name', reversed: false },
    });

    return <div class={css.root}>
        <Sidebar as="aside" label={'Grid options'} class={css.sidebar}>
            <fieldset>
                <legend>Commands</legend>

                <button onclick={() => api()?.insert({ id: crypto.randomUUID(), name: '', address: '', country: '', currency: '', email: '', phone: '' })}>add row</button>
                <button onclick={() => api()?.remove(api()?.selection()?.map(i => i.key as any) ?? [])} disabled={api()?.selection().length === 0}>Remove {api()?.selection().length} items</button>
            </fieldset>

            <fieldset>
                <legend>Selection ({api()?.selection().length})</legend>

                <ol>
                    <For each={api()?.selection()}>{
                        item => <li value={item.key}>{item.value().name}</li>
                    }</For>
                </ol>
            </fieldset>
        </Sidebar>

        <div class={css.content}>
            <Grid class={css.table} api={setApi} rows={rows} columns={columns} groupBy="country" />

            <fieldset class={css.mutaions}>
                <legend>Mutations ({mutations().length})</legend>

                <Mutations mutations={mutations()} />
            </fieldset>
        </div>
    </div >;
}

type M = { kind: MutarionKind, key: string, original?: any, value?: any };
const Mutations: Component<{ mutations: Mutation[] }> = (props) => {
    const columns: Column<M>[] = [{ id: 'key', label: 'Key' }, { id: 'original', label: 'Old' }, { id: 'value', label: 'New' }];

    const rows = createMemo(() => createDataSet<M>(props.mutations));

    createEffect(() => {
        rows().group({ by: 'kind' });
    });

    return <Table rows={rows()} columns={columns}>{{
        original: ({ value }) => value ? <del><pre>{JSON.stringify(value, null, 2)}</pre></del> : null,
        value: ({ value }) => value ? <ins><pre>{JSON.stringify(value, null, 2)}</pre></ins> : null,
    }}</Table>
};