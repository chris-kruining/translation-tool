import { Sidebar } from '~/components/sidebar';
import { Column, DataSetGroupNode, DataSetNode, DataSetRowNode, Grid, GridApi } from '~/components/grid';
import { people, Person } from './experimental.data';
import css from './grid.module.css';
import { createMemo, createSignal } from 'solid-js';

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
            editor: ({ value }) => <input value={value} />,
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

    return <div class={css.root}>
        <Sidebar as="aside" label={'Mutations'} class={css.sidebar}>
            {mutations().length}
        </Sidebar>

        <div class={css.content}>
            <Grid api={setApi} rows={people} columns={columns} groupBy="country" />
        </div>
    </div >;
}