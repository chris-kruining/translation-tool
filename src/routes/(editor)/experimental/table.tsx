import { Sidebar } from '~/components/sidebar';
import { Column, createDataSet, DataSetGroupNode, DataSetNode, DataSetRowNode, GroupOptions, SelectionMode, SortOptions, Table } from '~/components/table';
import { createStore } from 'solid-js/store';
import { Person, people } from './experimental.data';
import css from './table.module.css';
import { createEffect, createMemo, For } from 'solid-js';

export default function TableExperiment() {
    const columns: Column<Person>[] = [
        {
            id: 'id',
            label: '#',
            groupBy(rows: DataSetRowNode<keyof Person, Person>[]) {
                const group = (nodes: (DataSetRowNode<keyof Person, Person> & { _key: string })[]): DataSetNode<keyof Person, Person>[] => nodes.every(n => n._key.includes('.') === false)
                    ? nodes
                    : Object.entries(Object.groupBy(nodes, r => String(r._key).split('.').at(0)!))
                        .map<DataSetGroupNode<keyof Person, Person>>(([key, nodes]) => ({ kind: 'group', key, groupedBy: 'id', nodes: group(nodes!.map(n => ({ ...n, _key: n._key.slice(key.length + 1) }))) }));

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

    const [store, setStore] = createStore<{ selectionMode: SelectionMode, group?: GroupOptions<Person>, sort?: SortOptions<Person> }>({
        selectionMode: SelectionMode.None,
        group: undefined,
        sort: undefined,
    });

    const rows = createMemo(() => createDataSet(people));

    createEffect(() => {
        rows().setGrouping(store.group);
    });

    createEffect(() => {
        rows().setSorting(store.sort);
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

                    <select value={store.group?.by ?? ''} oninput={e => setStore('group', 'by', (e.target.value || undefined) as any)}>
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

                    <select value={store.sort?.by ?? ''} oninput={e => setStore('sort', prev => e.target.value ? { by: e.target.value as keyof Person, reversed: prev?.reversed } : undefined)}>
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
            <Table class={css.table} rows={rows()} columns={columns} selectionMode={store.selectionMode} />
        </div>
    </div >;
}