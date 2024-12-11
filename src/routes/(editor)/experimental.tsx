import { Column, GroupNode, RowNode, Node, SelectionMode, Table } from "~/components/table";
import css from "./experimental.module.css";
import { Sidebar } from "~/components/sidebar";
import { createStore } from "solid-js/store";
import { createEffect, For } from "solid-js";
import { Person, people } from './experimental.data';

  const columns: Column<Person>[] = [
  const columns: Column<Entry>[] = [
    {
      id: 'key',
      label: 'Key',
      groupBy(rows: RowNode<Entry>[]) {
        const group = (nodes: (RowNode<Entry> & { _key: string })[]): Node<Entry>[] => nodes.every(n => n._key.includes('.') === false)
          ? nodes
          : Object.entries(Object.groupBy(nodes, r => String(r._key).split('.').at(0)!))
            .map<GroupNode<Entry>>(([key, nodes]) => ({ kind: 'group', key, groupedBy: 'key', nodes: group(nodes!.map(n => ({ ...n, _key: n._key.slice(key.length + 1) }))) }));

        return group(rows.map(row => ({ ...row, _key: row.value.key })));
      },
    },
    {
      id: 'value',
      label: 'Value',
    },
  ];

  const [store, setStore] = createStore<{ selectionMode: SelectionMode, groupBy?: keyof Entry, sort?: { by: keyof Entry, reversed?: boolean } }>({
    selectionMode: SelectionMode.None,
    // groupBy: 'value',
    // sortBy: 'key'
  });

  createEffect(() => {
    console.log({ ...store });
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
      <Table rows={people} columns={columns} groupBy={store.groupBy} sort={store.sort} selectionMode={store.selectionMode}>{{
        address: (cell) => <input type="text" value={cell.value} />,
      }}</Table>
    </div>
  </div >;
}