import { Sidebar } from '~/components/sidebar';
import css from './table.module.css';
import { Column, DataSetGroupNode, DataSetNode, DataSetRowNode, SelectionMode, Table } from '~/components/table';
import { createStore } from 'solid-js/store';
import { Person, people } from './experimental.data';

export default function TableExperiment() {
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

    const [store, setStore] = createStore<{ selectionMode: SelectionMode, groupBy?: keyof Person, sort?: { by: keyof Person, reversed?: boolean } }>({
        selectionMode: SelectionMode.None,
        // groupBy: 'value',
        // sortBy: 'key'
    });

    return <div class={css.root}>
        <Sidebar as="aside" label={'Filters'} class={css.sidebar}>
            <fieldset>
                <legend>table properties</legend>

                <label>
                    Selection mode

                    <select value={store.selectionMode} oninput={e => setStore('selectionMode', Number.parseInt(e.target.value))}>
                        <option value={SelectionMode.None}>None</option>
                        <option value={SelectionMode.Single}>Single</option>
                        <option value={SelectionMode.Multiple}>Multiple</option>
                    </select>
                </label>

                <label>
                    Group by

                    <select value={store.groupBy ?? ''} oninput={e => setStore('groupBy', (e.target.value || undefined) as any)}>
                        <option value=''>None</option>
                        <For each={columns}>{
                            column => <option value={column.id}>{column.label}</option>
                        }</For>
                    </select>
                </label>
            </fieldset>

            <fieldset>
                <legend>table sorting</legend>

                <label>
                    by

                    <select value={store.sort?.by ?? ''} oninput={e => setStore('sort', prev => e.target.value ? { by: e.target.value as keyof Entry, reversed: prev?.reversed } : undefined)}>
                        <option value=''>None</option>
                        <For each={columns}>{
                            column => <option value={column.id}>{column.label}</option>
                        }</For>
                    </select>
                </label>

                <label>
                    reversed

                    <input type="checkbox" checked={store.sort?.reversed ?? false} oninput={e => setStore('sort', prev => prev !== undefined ? { by: prev.by, reversed: e.target.checked || undefined } : undefined)} />
                </label>
            </fieldset>
        </Sidebar>

        <div class={css.content}>
            <Table class={css.table} rows={people} columns={columns} groupBy={store.groupBy} sort={store.sort} selectionMode={store.selectionMode}>{{
                // email: (cell) => <input type="email" value={cell.value} />,
            }}</Table>
        </div>
    </div >;
}