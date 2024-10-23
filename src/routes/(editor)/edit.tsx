import { children, Component, createEffect, createMemo, createResource, createSignal, createUniqueId, For, onMount, ParentProps, Show } from "solid-js";
import { filter, MutarionKind, splitAt } from "~/utilities";
import { Sidebar } from "~/components/sidebar";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree, FileEntry, Entry } from "~/components/filetree";
import { Menu } from "~/features/menu";
import { Grid, load, useFiles } from "~/features/file";
import { Command, Context, createCommand, Modifier, noop } from "~/features/command";
import { GridApi } from "~/features/file/grid";
import css from "./edit.module.css";
import { Tab, Tabs } from "~/components/tabs";

async function* walk(directory: FileSystemDirectoryHandle, path: string[] = []): AsyncGenerator<{ id: string, handle: FileSystemFileHandle, path: string[], lang: string, entries: Map<string, string> }, void, never> {
    for await (const handle of directory.values()) {
        if (handle.kind === 'directory') {
            yield* walk(handle, [...path, handle.name]);

            continue;
        }

        if (!handle.name.endsWith('.json')) {
            continue;
        }

        const id = await handle.getUniqueId();
        const file = await handle.getFile();
        const lang = file.name.split('.').at(0)!;
        const entries = await load(file);

        if (entries !== undefined) {
            yield { id, handle, path, lang, entries };
        }
    }
};

function* breadthFirstTraverse(subject: FolderEntry): Generator<{ path: string[] } & Entry, void, unknown> {
    const queue: ({ path: string[] } & Entry)[] = subject.entries.map(e => ({ path: [], ...e }));

    while (queue.length > 0) {
        const entry = queue.shift()!;

        yield entry;

        if (entry.kind === 'folder') {
            queue.push(...entry.entries.map(e => ({ path: [...entry.path, entry.name], ...e })));
        }
    }
}

const findFile = (folder: FolderEntry, id: string) => {
    return breadthFirstTraverse(folder).find((entry): entry is { path: string[] } & FileEntry => entry.kind === 'file' && entry.id === id);
}

export default function Edit(props: ParentProps) {
    const filesContext = useFiles();
    const [root, { refetch: getRoot, mutate: updateRoot }] = createResource(() => filesContext?.get('__root__'));
    const [tabs, { refetch: getTabs }] = createResource<FileSystemDirectoryHandle[]>(async () => (await filesContext?.list()) ?? [], { initialValue: [], ssrLoadFrom: 'initial' });
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);
    const [entries, setEntries] = createSignal<Map<string, Record<string, { id: string, value: string, handle: FileSystemFileHandle }>>>(new Map);
    const [api, setApi] = createSignal<GridApi>();

    const mutatedFiles = createMemo(() => {
        const mutations = api()?.mutations() ?? [];
        const files = entries();

        return new Set(mutations
            .map(mutation => {
                const [key, lang] = splitAt(mutation.key, mutation.key.lastIndexOf('.'));

                return files.get(key)?.[lang]?.id;
            })
            .filter(file => file !== undefined)
        );
    });

    // Since the files are stored in indexedDb we need to refetch on the client in order to populate on page load
    onMount(() => {
        getRoot();
        getTabs();
    });

    createEffect(async () => {
        const directory = root();

        if (root.state === 'ready' && directory?.kind === 'directory') {
            const contents = await Array.fromAsync(walk(directory));
            const languages = new Set(contents.map(c => c.lang));
            const template = contents.map(({ lang, handle }) => [lang, { handle, value: '' }]);

            const merged = contents.reduce((aggregate, { id, handle, path, lang, entries }) => {
                for (const [key, value] of entries.entries()) {
                    const k = [...path, key].join('.');

                    if (!aggregate.has(k)) {
                        aggregate.set(k, Object.fromEntries(template));
                    }

                    aggregate.get(k)![lang] = { value, handle, id };
                }

                return aggregate;
            }, new Map<string, Record<string, { id: string, value: string, handle: FileSystemFileHandle }>>());

            setFiles({ name: directory.name, id: '', kind: 'folder', entries: await Array.fromAsync(fileTreeWalk(directory)) });
            setEntries(merged);
        }
    });

    const commands = {
        open: createCommand('open', async () => {
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
        openFolder: createCommand('open folder', async () => {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

            filesContext.set('__root__', directory);
            updateRoot(directory);
        }),
        save: createCommand('save', async () => {
            const mutations = api()?.mutations() ?? [];

            if (mutations.length === 0) {
                return;
            }

            const rows = api()?.rows() ?? {};
            const _entries = entries();

            // Cases we can encounter:
            // |         | file extsis               | no existing file     |
            // |---------|---------------------------|----------------------!
            // | created | insert new key into file  | create new file      |
            // | updated | update value              | create new file (*1) |
            // | deleted | remove key from file (*3) | no-op/skip (*2)(*3)  |
            //
            // 1) This can happen if the key already exists in another language (so when adding a new language for example).
            // 2) The same as with 1, when you delete a key, and there are not files for each language, then this is a valid case.
            // 3) When a file has 0 keys, we can remove it.

            const fileMutations = await Promise.all(mutations.map(async (mutation) => {
                const [k, lang] = splitAt(mutation.key, mutation.key.lastIndexOf('.'));
                const entry = _entries.get(k);
                const localEntry = entry?.[lang];

                if (!localEntry) {
                    throw new Error('invalid edge case???');
                }

                const createNewFile = async () => {
                    const [, alternativeLocalEntry] = Object.entries(entry).find(([l, e]) => l !== lang && e.id !== undefined) ?? [];
                    const { directory, path } = alternativeLocalEntry ? findFile(tree(), alternativeLocalEntry.id) ?? {} : {};

                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${lang}.json`,
                        startIn: directory,
                        excludeAcceptAllOption: true,
                        types: [
                            { accept: { 'application/json': ['.json'] }, description: 'JSON' },
                        ]
                    });

                    // TODO :: patch the tree with this new entry
                    // console.log(localEntry, tree());

                    return { handle, path };
                };

                const { handle, path } = findFile(tree(), localEntry.id) ?? (mutation.kind !== MutarionKind.Delete ? await createNewFile() : {});
                const id = await handle?.getUniqueId();
                const key = path ? k.slice(path.join('.').length + 1) : k;
                const value = rows[k][lang];

                return { action: mutation.kind, key, id, value, handle };
            }));

            console.log(rows, entries(), Object.groupBy(fileMutations, m => m.id ?? 'undefined'))
        }, { key: 's', modifier: Modifier.Control }),
        saveAs: createCommand('save as', (handle?: FileSystemFileHandle) => {
            console.log('save as ...', handle);

            window.showSaveFilePicker({
                startIn: root(),
                excludeAcceptAllOption: true,
                types: [
                    { accept: { 'application/json': ['.json'] }, description: 'JSON' },
                    { accept: { 'application/yaml': ['.yml', '.yaml'] }, description: 'YAML' },
                    { accept: { 'application/csv': ['.csv'] }, description: 'CSV' },
                ]
            });

        }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
        selectAll: createCommand('select all', () => {
            api()?.selectAll();
        }, { key: 'a', modifier: Modifier.Control }),
        clearSelection: createCommand('clear selection', () => {
            api()?.clear();
        }),
    } as const;

    return <div class={css.root}>
        <Context.Root commands={[commands.saveAs]}>
            <Context.Menu>{
                command => <Command command={command} />
            }</Context.Menu>

            <Menu.Root>
                <Menu.Item label="file">
                    <Menu.Item command={commands.open} />

                    <Menu.Item command={commands.openFolder} />

                    <Menu.Item command={commands.save} />
                </Menu.Item>

                <Menu.Item command={noop.withLabel('edit')} />

                <Menu.Item label="selection">
                    <Menu.Item command={commands.selectAll} />

                    <Menu.Item command={commands.clearSelection} />
                </Menu.Item>

                <Menu.Item command={noop.withLabel('view')} />
            </Menu.Root>

            <Sidebar as="aside" label={tree().name} class={css.sidebar}>
                <Show when={!root.loading && root()} fallback={<button onpointerdown={() => commands.openFolder()}>open a folder</button>}>
                    <Tree entries={tree().entries}>{[
                        folder => {
                            return <span onDblClick={() => {
                                filesContext?.set(folder().name, folder().handle);
                                getTabs();
                            }}>{folder().name}</span>;
                        },
                        file => {
                            const mutated = createMemo(() => mutatedFiles().has(file().id));

                            return <Context.Handle classList={{ [css.mutated]: mutated() }}>{file().name}</Context.Handle>;
                        },
                    ] as const}</Tree>
                </Show>
            </Sidebar>

            <Tabs>
                <For each={tabs()}>{
                    directory => <Tab id={createUniqueId()} label={directory.name}>{'some text in front'}<Kaas directory={directory} /></Tab>
                }</For>
            </Tabs>
        </Context.Root>
    </div>
}

const Kaas: Component<{ directory: FileSystemDirectoryHandle }> = (props) => {
    const filesContext = useFiles();
    const [root, { mutate, refetch }] = createResource(() => filesContext?.get('root'));
    const [columns, setColumns] = createSignal<string[]>([]);
    const [rows, setRows] = createSignal<Map<string, Record<string, string>>>(new Map);
    const [entries, setEntries] = createSignal<Map<string, Record<string, { id: string, value: string, handle: FileSystemFileHandle }>>>(new Map);
    const [api, setApi] = createSignal<GridApi>();

    createEffect(() => {
        const directory = props.directory;

        if (!directory) {
            return;
        }

        (async () => {
            const contents = await Array.fromAsync(
                filter(directory.values(), (handle): handle is FileSystemFileHandle => handle.kind === 'file' && handle.name.endsWith('.json')),
                async handle => {
                    const id = await handle.getUniqueId();
                    const file = await handle.getFile();
                    const lang = file.name.split('.').at(0)!;
                    const entries = (await load(file))!;

                    return { id, handle, lang, entries };
                }
            );
            const languages = new Set(contents.map(c => c.lang));
            const template = contents.map(({ lang, handle }) => [lang, { handle, value: '' }]);

            const merged = contents.reduce((aggregate, { id, handle, lang, entries }) => {
                for (const [key, value] of entries.entries()) {
                    if (!aggregate.has(key)) {
                        aggregate.set(key, Object.fromEntries(template));
                    }

                    aggregate.get(key)![lang] = { value, handle, id };
                }

                return aggregate;
            }, new Map<string, Record<string, { id: string, value: string, handle: FileSystemFileHandle }>>());

            setColumns(['key', ...languages]);
            setRows(new Map(merged.entries().map(([key, langs]) => [key, Object.fromEntries(Object.entries(langs).map(([lang, { value }]) => [lang, value]))] as const)));
        })();
    });

    createEffect(() => {
        // console.log(columns(), rows());
    });

    return <Grid columns={columns()} rows={rows()} api={setApi} />;
};