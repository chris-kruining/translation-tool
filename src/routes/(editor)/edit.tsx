import { Component, createEffect, createMemo, createSignal, For, ParentProps, Setter, Show } from "solid-js";
import { filter, MutarionKind, Mutation, splitAt } from "~/utilities";
import { Sidebar } from "~/components/sidebar";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree } from "~/components/filetree";
import { Menu } from "~/features/menu";
import { Grid, load, useFiles } from "~/features/file";
import { Command, Context, createCommand, Modifier, noop, useCommands } from "~/features/command";
import { GridApi } from "~/features/file/grid";
import { Tab, Tabs } from "~/components/tabs";
import css from "./edit.module.css";
import { isServer } from "solid-js/web";

const isInstalledPWA = !isServer && window.matchMedia('(display-mode: standalone)').matches;

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

const open = createCommand('open folder', async () => {
    const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

    useFiles().set('__root__', directory);
}, { key: 'o', modifier: Modifier.Control });

interface Entries extends Map<string, Record<string, { value: string, handle: FileSystemFileHandle, id: string }>> { }

export default function Edit(props: ParentProps) {
    const filesContext = useFiles();

    const root = filesContext.get('__root__');

    return <Context.Root commands={[open]}>
        <Show when={root()} fallback={<button onpointerdown={() => open()}>open a folder</button>}>{
            root => <Editor root={root()} />
        }</Show>
    </Context.Root>;
}

const Editor: Component<{ root: FileSystemDirectoryHandle }> = (props) => {
    const filesContext = useFiles();

    const tabs = createMemo(() => filesContext.files().map(({ handle }) => {
        const [api, setApi] = createSignal<GridApi>();
        const [entries, setEntries] = createSignal<Entries>(new Map());

        return ({ handle, api, setApi, entries, setEntries });
    }));
    const [active, setActive] = createSignal<string>();
    const [contents, setContents] = createSignal<Map<string, Map<string, string>>>(new Map());
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);

    const tab = createMemo(() => {
        const name = active();
        return tabs().find(t => t.handle.name === name);
    });
    const api = createMemo(() => tab()?.api());
    const mutations = createMemo<(Mutation & { file?: { value: string, handle: FileSystemFileHandle, id: string } })[]>(() => tabs().flatMap(tab => {
        const entries = tab.entries();
        const mutations = tab.api()?.mutations() ?? [];

        return mutations.map(m => {
            const [key, lang] = splitAt(m.key, m.key.lastIndexOf('.'));

            return { ...m, key, file: entries.get(key)?.[lang] };
        });
    }));
    const mutatedFiles = createMemo(() =>
        new Set((mutations()).map(({ file }) => file).filter(file => file !== undefined))
    );
    const mutatedData = createMemo(() => {
        const muts = mutations();
        const files = contents();
        const entries = mutatedFiles().values();

        if (muts.length === 0) {
            return [];
        }

        const groupedByFileId = Object.groupBy(muts, m => m.file?.id ?? 'undefined');

        return entries.map(({ id, handle }) => {
            const existing = new Map(files.get(id)!);
            const mutations = groupedByFileId[id]!;

            for (const mutation of mutations) {
                switch (mutation.kind) {
                    case MutarionKind.Delete: {
                        existing.delete(mutation.key);
                        break;
                    }

                    case MutarionKind.Update:
                    case MutarionKind.Create: {
                        existing.set(mutation.key, mutation.value);
                        break;
                    }
                }
            }

            return [
                handle,
                existing.entries().reduce((aggregate, [key, value]) => {
                    let obj = aggregate;
                    const [k, lastPart] = splitAt(key, key.lastIndexOf('.'));

                    for (const part of k.split('.')) {
                        if (!Object.hasOwn(obj, part)) {
                            obj[part] = {};
                        }

                        obj = obj[part];
                    }

                    obj[lastPart] = value;

                    return aggregate;
                }, {} as Record<string, any>)
            ] as const;
        }).toArray();
    });

    createEffect(() => {
        const directory = props.root;

        (async () => {
            setContents(new Map(await Array.fromAsync(walk(directory), ({ id, entries }) => [id, entries] as const)))
            setFiles({ name: directory.name, id: '', kind: 'folder', handle: directory, entries: await Array.fromAsync(fileTreeWalk(directory)) });
        })();
    });

    const commands = {
        close: createCommand('close folder', async () => {
            filesContext.remove('__root__');
        }),
        closeTab: createCommand('close tab', async (id: string) => {
            filesContext.remove(id);
        }, { key: 'w', modifier: Modifier.Control | (isInstalledPWA ? Modifier.None : Modifier.Alt) }),
        save: createCommand('save', async () => {
            await Promise.allSettled(mutatedData().map(async ([handle, data]) => {
                const stream = await handle.createWritable({ keepExistingData: false });

                stream.write(JSON.stringify(data, null, 4));
                stream.write('\n');
                stream.close();
            }));
        }, { key: 's', modifier: Modifier.Control }),
        saveAs: createCommand('save as', (handle?: FileSystemFileHandle) => {
            console.log('save as ...', handle);

            window.showSaveFilePicker({
                startIn: props.root,
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
        delete: createCommand('delete selected items', () => {
            console.log(api()?.selection())
        }, { key: 'delete', modifier: Modifier.None }),
    } as const;

    const commandCtx = useCommands();

    return <div class={css.root}>
        <Command.Add commands={[commands.saveAs, commands.closeTab]} />

        <Context.Menu>{
            command => <Command.Handle command={command} />
        }</Context.Menu>

        <Menu.Root>
            <Menu.Item label="file">
                <Menu.Item command={commands.open} />

                <Menu.Item command={commands.close} />

                <Menu.Separator />

                <Menu.Item command={commands.save} />
            </Menu.Item>

            <Menu.Item label="edit">
                <Menu.Item command={noop.withLabel('insert new key')} />

                <Menu.Item command={noop.withLabel('insert new language')} />

                <Menu.Separator />

                <Menu.Item command={commands.delete} />
            </Menu.Item>

            <Menu.Item label="selection">
                <Menu.Item command={commands.selectAll} />

                <Menu.Item command={commands.clearSelection} />
            </Menu.Item>

            <Menu.Item command={noop.withLabel('view')} />
        </Menu.Root>

        <Sidebar as="aside" label={tree().name} class={css.sidebar}>
            <Tree entries={tree().entries}>{[
                folder => {
                    return <span onDblClick={() => {
                        filesContext?.set(folder().name, folder().handle);
                    }}>{folder().name}</span>;
                },
                file => {
                    const mutated = createMemo(() => mutatedFiles().values().find(({ id }) => id === file().id) !== undefined);

                    return <Context.Handle classList={{ [css.mutated]: mutated() }} onDblClick={() => {
                        const folder = file().directory;
                        filesContext?.set(folder.name, folder);
                    }}>{file().name}</Context.Handle>;
                },
            ] as const}</Tree>
        </Sidebar>

        <Tabs active={setActive} onClose={commands.closeTab}>
            <For each={tabs()}>{
                ({ handle, setApi, setEntries }) => <Tab
                    id={handle.name}
                    label={handle.name}
                    closable
                >
                    <Content directory={handle} api={setApi} entries={setEntries} />
                </Tab>
            }</For>
        </Tabs>
    </div>;
};

const Content: Component<{ directory: FileSystemDirectoryHandle, api?: Setter<GridApi | undefined>, entries?: Setter<Entries> }> = (props) => {
    const [entries, setEntries] = createSignal<Entries>(new Map());
    const [columns, setColumns] = createSignal<string[]>([]);
    const [rows, setRows] = createSignal<Map<string, Record<string, string>>>(new Map);
    const [api, setApi] = createSignal<GridApi>();

    createEffect(() => {
        props.entries?.(entries());
    });

    createEffect(() => {
        props.api?.(api());
    });

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
            setEntries(merged);
            setRows(new Map(merged.entries().map(([key, langs]) => [key, Object.fromEntries(Object.entries(langs).map(([lang, { value }]) => [lang, value]))] as const)));
        })();
    });

    return <Grid columns={columns()} rows={rows()} api={setApi} />;
};