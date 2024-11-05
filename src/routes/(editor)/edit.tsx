import { Component, createEffect, createMemo, createSignal, For, onMount, ParentProps, Setter, Show } from "solid-js";
import { filter, MutarionKind, Mutation, splitAt } from "~/utilities";
import { Sidebar } from "~/components/sidebar";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree } from "~/components/filetree";
import { Menu } from "~/features/menu";
import { Grid, load, useFiles } from "~/features/file";
import { Command, CommandType, Context, createCommand, Modifier, noop, useCommands } from "~/features/command";
import { GridApi } from "~/features/file/grid";
import { Tab, Tabs } from "~/components/tabs";
import css from "./edit.module.css";
import { isServer } from "solid-js/web";
import { Prompt, PromptApi } from "~/components/prompt";

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


interface Entries extends Map<string, Record<string, { value: string, handle: FileSystemFileHandle, id: string }>> { }

export default function Edit(props: ParentProps) {
    const filesContext = useFiles();

    const open = createCommand('open folder', async () => {
        const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

        filesContext.open(directory);
    }, { key: 'o', modifier: Modifier.Control });

    return <Context.Root commands={[open]}>
        <Show when={filesContext.root()} fallback={<Blank open={open} />}>{
            root => <Editor root={root()} />
        }</Show>
    </Context.Root>;
}

const Editor: Component<{ root: FileSystemDirectoryHandle }> = (props) => {
    const filesContext = useFiles();

    const tabs = createMemo(() => filesContext.files().map(({ key, handle }) => {
        const [api, setApi] = createSignal<GridApi>();
        const [entries, setEntries] = createSignal<Entries>(new Map());
        const [files, setFiles] = createSignal<Map<string, { id: string, handle: FileSystemFileHandle }>>(new Map());

        (async () => {
            const files = await Array.fromAsync(
                filter(handle.values(), entry => entry.kind === 'file'),
                async file => [file.name.split('.').at(0)!, { handle: file, id: await file.getUniqueId() }] as const
            );

            setFiles(new Map(files));
        })();

        return ({ key, handle, api, setApi, entries, setEntries, files });
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
        const files = tab.files();
        const mutations = tab.api()?.mutations() ?? [];

        return mutations.flatMap(m => {
            switch (m.kind) {
                case MutarionKind.Update: {
                    const [key, lang] = splitAt(m.key, m.key.lastIndexOf('.'));

                    return { kind: MutarionKind.Update, key, file: entries.get(key)?.[lang] };
                }

                case MutarionKind.Create: {
                    return Object.entries(m.value).map(([lang, value]) => ({ kind: MutarionKind.Create, key: m.key, file: files.get(lang)!, value }));
                }

                case MutarionKind.Delete: {
                    return files.values().map(file => ({ kind: MutarionKind.Delete, key: m.key, file })).toArray();
                }

                default: throw new Error('unreachable code');
            }
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
                    const i = key.lastIndexOf('.');

                    if (i !== -1) {
                        const [k, lastPart] = splitAt(key, i);

                        for (const part of k.split('.')) {
                            if (!Object.hasOwn(obj, part)) {
                                obj[part] = {};
                            }

                            obj = obj[part];
                        }

                        obj[lastPart] = value;
                    }
                    else {
                        obj[key] = value;
                    }

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

    const [prompt, setPrompt] = createSignal<PromptApi>();

    const commands = {
        open: createCommand('open folder', async () => {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

            await filesContext.open(directory);
        }, { key: 'o', modifier: Modifier.Control }),
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
            const { selection, remove } = api() ?? {};

            if (!selection || !remove) {
                return;
            }

            remove(Object.keys(selection()));
        }, { key: 'delete', modifier: Modifier.None }),
        inserNewKey: createCommand('insert new key', async () => {
            const formData = await prompt()?.showModal();
            const key = formData?.get('key')?.toString();

            if (!key) {
                return;
            }

            api()?.insert(key);
        }),
        inserNewLanguage: noop.withLabel('insert new language'),
    } as const;

    return <div class={css.root}>
        <Command.Add commands={[commands.saveAs, commands.closeTab]} />

        <Context.Menu>{
            command => <Command.Handle command={command} />
        }</Context.Menu>

        <Menu.Root>
            <Menu.Item label="file">
                <Menu.Item command={commands.open} />

                <Menu.Item command={commands.save} />
            </Menu.Item>

            <Menu.Item label="edit">
                <Menu.Item command={commands.inserNewKey} />

                <Menu.Item command={commands.inserNewLanguage} />

                <Menu.Separator />

                <Menu.Item command={commands.delete} />
            </Menu.Item>

            <Menu.Item label="selection">
                <Menu.Item command={commands.selectAll} />

                <Menu.Item command={commands.clearSelection} />
            </Menu.Item>

            <Menu.Item command={noop.withLabel('view')} />
        </Menu.Root>

        <Prompt api={setPrompt} title="Which key do you want to create?" description={<>hint: use <code>.</code> to denote nested keys,<br /> i.e. <code>this.is.some.key</code> would be a key that is four levels deep</>}>
            <input name="key" value="this.is.an.awesome.key" placeholder="name of new key ()" />
        </Prompt>

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

            <span>Total mutation: {mutations().length}</span>
        </Sidebar>

        <Tabs active={setActive} onClose={commands.closeTab}>
            <For each={tabs()}>{
                ({ key, handle, setApi, setEntries }) => <Tab
                    id={key}
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

const Blank: Component<{ open: CommandType }> = (props) => {
    return <div class={css.blank}>
        <button onpointerdown={() => props.open()}>open a folder</button>
    </div>
};