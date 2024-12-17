import { Sidebar } from '~/components/sidebar';
import { Column, DataSetGroupNode, DataSetNode, DataSetRowNode, Grid, GridApi } from '~/components/grid';
import { people, Person } from './experimental.data';
import { Component, createEffect, createMemo, createSignal, For, Match, Switch } from 'solid-js';
import { Created, debounce, Deleted, MutarionKind, Mutation, Updated } from '~/utilities';
import { createDataSet, Table } from '~/components/table';
import css from './grid.module.css';

export default function GridExperiment() {
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
        },
        {
            id: 'email',
            label: 'Email',
            sortable: true,
            editor: ({ value, mutate }) => <input value={value} oninput={debounce(e => {
                console.log('WHAAAAT????', e);
                return mutate(e.target.value.trim());
            }, 100)} />,
        },
        {
            id: 'address',
            label: 'Address',
            sortable: true,
        },
        {
            id: 'currency',
            label: 'Currency',
            sortable: true,
        },
        {
            id: 'phone',
            label: 'Phone',
            sortable: true,
        },
        {
            id: 'country',
            label: 'Country',
            sortable: true,
        },
    ];

    const [api, setApi] = createSignal<GridApi<Person>>();

    const mutations = createMemo(() => api()?.mutations() ?? [])

    // createEffect(() => {
    //     console.log(mutations());
    // });

    return <div class={css.root}>
        <Sidebar as="aside" label={'Grid options'} class={css.sidebar}>
            <fieldset>
                <legend>Commands</legend>

                <button onclick={() => api()?.insert({ id: 'some guid', name: 'new person', address: '', country: '', currency: '', email: 'some@email.email', phone: '' })}>add row</button>
                <button onclick={() => api()?.remove(api()?.selection()?.map(i => i.key as any) ?? [])} disabled={api()?.selection().length === 0}>Remove {api()?.selection().length} items</button>
            </fieldset>

            <fieldset>
                <legend>Selection ({api()?.selection().length})</legend>

                <pre>{JSON.stringify(api()?.selection().map(i => i.key))}</pre>
            </fieldset>

            <fieldset>
                <legend>Mutations ({mutations().length})</legend>

                <Mutations mutations={mutations()} />
            </fieldset>
        </Sidebar>

        <div class={css.content}>
            <Grid api={setApi} rows={people} columns={columns} groupBy="country" />
        </div>
    </div >;
}

type M = { kind: MutarionKind, key: string, original?: any, value?: any };
const Mutations: Component<{ mutations: Mutation[] }> = (props) => {
    const columns: Column<M>[] = [{ id: 'key', label: 'Key' }, { id: 'original', label: 'original' }, { id: 'value', label: 'Value' }];

    const rows = createMemo(() => createDataSet<M>(props.mutations));

    return <Table rows={rows()} columns={columns} groupBy='kind'>{{
        original: ({ value }) => <del>{value}</del>,
        value: ({ value }) => <ins>{value}</ins>,
    }}</Table>
};