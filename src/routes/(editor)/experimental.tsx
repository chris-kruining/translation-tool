import { Table } from "~/components/table";
import css from "./experimental.module.css";
import { Sidebar } from "~/components/sidebar";

export default function Experimental() {
  const rows = [
    { key: 'key1.a.a', value: 10 },
    { key: 'key1.a.b', value: 20 },
    { key: 'key1.a.c', value: 30 },
    { key: 'key1.b.a', value: 40 },
    { key: 'key1.b.b', value: 50 },
    { key: 'key1.b.c', value: 60 },
    { key: 'key1.c.a', value: 70 },
    { key: 'key1.c.b', value: 80 },
    { key: 'key1.c.c', value: 90 },

    { key: 'key2.a.a', value: 10 },
    { key: 'key2.a.b', value: 20 },
    { key: 'key2.a.c', value: 30 },
    { key: 'key2.b.a', value: 40 },
    { key: 'key2.b.b', value: 50 },
    { key: 'key2.b.c', value: 60 },
    { key: 'key2.c.a', value: 70 },
    { key: 'key2.c.b', value: 80 },
    { key: 'key2.c.c', value: 90 },
  ];

  return <div class={css.root}>
    <Sidebar as="aside" label={'Filters'} class={css.sidebar} />

    <div class={css.content}>
      <Table rows={rows} />
    </div>
  </div>;
}