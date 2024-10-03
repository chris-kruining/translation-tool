import { createCommand, Menu, Modifier } from "~/features/menu";
import { Component, createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { useFiles } from "~/features/file";
import "./edit.css";

interface Entry extends Record<string, Entry | string> { }

interface Leaf extends Record<string, string> { }
interface Entry2 extends Record<string, Entry2 | Leaf> { }

async function* walk(directory: FileSystemDirectoryHandle, path: string[] = []): AsyncGenerator<{ lang: string, entries: Entry }, void, never> {
    for await (const handle of directory.values()) {
        if (handle.kind === 'directory') {
            yield* walk(handle, [...path, handle.name]);

            continue;
        }

        if (!handle.name.endsWith('.json')) {
            continue;
        }

        const file = await handle.getFile();

        if (file.type !== 'application/json') {
            continue;
        }

        const lang = file.name.split('.').at(0)!;
        const text = await file.text();
        const root: Entry = {};

        let current: Entry = root;
        for (const key of path) {
            current[key] = {};

            current = current[key];
        }
        Object.assign(current, JSON.parse(text));

        yield { lang, entries: root };
    }
};

export default function Edit(props) {
    const files = useFiles();
    const [root, { mutate, refetch }] = createResource(() => files.get('root'));

    // Since the files are stored in indexedDb we need to refetch on the client in order to populate on page load
    onMount(() => {
        refetch();
    });

    createEffect(async () => {
        const directory = root();

        if (root.state === 'ready' && directory?.kind === 'directory') {
            const contents = await Array.fromAsync(walk(directory));

            const entries = Object.entries(
                Object.groupBy(contents, e => e.lang)
            ).map(([lang, entries]) => ({
                lang,
                entries: entries!
                    .map(e => e.entries)
                    .reduce((o, e) => {
                        Object.assign(o, e);

                        return o;
                    }, {})
            }));

            const assign = (lang: string, entries: Entry) => {
                return Object.entries(entries).reduce((aggregate, [key, value]) => {
                    const v = typeof value === 'string' ? { [lang]: value } : assign(lang, value);

                    Object.assign(aggregate, { [key]: v });

                    return aggregate;
                }, {});
            }

            const unified = contents.reduce((aggregate, { lang, entries }) => {
                Object.assign(aggregate, assign(lang, entries));

                return aggregate;
            }, {});

            setColumns(['key', ...new Set(contents.map(c => c.lang))]);
            setRows(unified);
        }
    });

    const commands = {
        open: createCommand(async () => {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: "JSON File(s)",
                        accept: {
                            "application/json": [".json", ".jsonp", ".jsonc"],
                        },
                    }
                ],
                excludeAcceptAllOption: true,
                multiple: true,
            });
            const file = await fileHandle.getFile();
            const text = await file.text();

            console.log(fileHandle, file, text);
        }, { key: 'o', modifier: Modifier.Control }),
        openFolder: createCommand(async () => {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

            files.set('root', directory);
            mutate(directory);
        }),
        save: createCommand(() => {
            console.log('save');
        }, { key: 's', modifier: Modifier.Control }),
        saveAll: createCommand(() => {
            console.log('save all');
        }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
        edit: createCommand(() => {
        }),
        selection: createCommand(() => { }),
        view: createCommand(() => { }),
    } as const;

    const [columns, setColumns] = createSignal([]);
    const [rows, setRows] = createSignal<Entry2>({});

    const Row: Component<{ entry: Entry2 }> = (props) => {
        return <For each={Object.entries(props.entry)}>{
            ([key, value]) => {
                const values = Object.values(value);
                const isLeaf = values.some(v => typeof v === 'string');

                return <Show when={isLeaf} fallback={<Group key={key} entry={value as Entry2} />}>
                    <input type="checkbox" />

                    <span>{key}</span>

                    <For each={values}>{
                        value => <input type="" value={value} />
                    }</For>
                </Show>;
            }
        }</For>
    };

    const Group: Component<{ key: string, entry: Entry2 }> = (props) => {
        return <details open>
            <summary>{props.key}</summary>

            <Row entry={props.entry} />
        </details>;
    };

    const columnCount = createMemo(() => columns().length - 1);

    return <>
        <Menu.Root>
            <Menu.Item label="file">
                <Menu.Item label="open" command={commands.open} />

                <Menu.Item label="open folder" command={commands.openFolder} />

                <Menu.Item label="save" command={commands.save} />

                <Menu.Item label="save all" command={commands.saveAll} />
            </Menu.Item>

            <Menu.Item label="edit" command={commands.edit} />

            <Menu.Item label="selection" command={commands.selection} />

            <Menu.Item label="view" command={commands.view} />
        </Menu.Root>

        <section class="table" style={{ '--columns': columnCount() }}>
            <header>
                <input type="checkbox" />

                <For each={columns()}>{
                    column => <span>{column}</span>
                }</For>
            </header>

            <main>
                <Row entry={rows()} />
            </main>
        </section>

        {/* <AgGridSolid
            singleClickEdit
            columnDefs={columnDefs()}
            rowData={rowData()}
            defaultColDef={defaultColDef} /> */}
    </>
}
