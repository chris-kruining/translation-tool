import { children, createEffect, createMemo, createResource, createSignal, createUniqueId, onMount, ParentProps } from "solid-js";
import { MutarionKind, splitAt } from "~/utilities";
import { Sidebar } from "~/components/sidebar";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree, FileEntry, Entry } from "~/components/filetree";
import { Menu } from "~/features/menu";
import { Grid, load, useFiles } from "~/features/file";
import { Command, Context, createCommand, Modifier, noop } from "~/features/command";
import { GridApi } from "~/features/file/grid";
import css from "./edit.module.css";
import { match } from "ts-pattern";

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
    const [root, { mutate, refetch }] = createResource(() => filesContext?.get('root'));
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);
    const [columns, setColumns] = createSignal<string[]>([]);
    const [rows, setRows] = createSignal<Map<string, Record<string, string>>>(new Map);
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
        refetch();
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

            setFiles({ name: '', id: '', kind: 'folder', entries: await Array.fromAsync(fileTreeWalk(directory)) });
            setColumns(['key', ...languages]);
            setEntries(merged);
            setRows(new Map(merged.entries().map(([key, langs]) => [key, Object.fromEntries(Object.entries(langs).map(([lang, { value }]) => [lang, value]))] as const)));
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

            filesContext.set('root', directory);
            mutate(directory);
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

            for (const mutation of mutations) {
                const [k, lang] = splitAt(mutation.key, mutation.key.lastIndexOf('.'));
                const entry = _entries.get(k);
                const localEntry = entry?.[lang];

                // TODO :: try to resolve to a file
                //
                // |   | entry | localEntry | id | file |
                // |---|-------!------------|----!------!
                // | 1 | x     | x          | x  | x    |
                // | 2 | x     | x          | x  |      |
                // | 3 | x     | x          |    |      |
                // | 4 | x     |            |    |      |
                // | 5 |       |            |    |      |
                //
                // 1. happy path
                // 2. weird edge case
                // 3. this language never had a file before. peek at at another language and create a new file with a mathing path
                // 4. error?
                // 5. error?

                if (!localEntry) {
                    throw new Error('invalid edge case???');
                }

                const [handle, path = []] = await (async () => {
                    if (localEntry.id === undefined) {
                        const [, alternativeLocalEntry] = Object.entries(entry).find(([l, e]) => l !== lang && e.id !== undefined) ?? [];

                        const { directory, path } = alternativeLocalEntry ? findFile(tree(), alternativeLocalEntry.id) ?? {} : {};

                        // Short circuit if the mutation type is delete.
                        // Otherwise we would create a new file handle,
                        // and then immediately remove it again.
                        if (mutation.kind === MutarionKind.Delete) {
                            return [undefined, path] as const;
                        }

                        const handle = await window.showSaveFilePicker({
                            suggestedName: `${lang}.json`,
                            startIn: directory ?? root(),
                            excludeAcceptAllOption: true,
                            types: [
                                { accept: { 'application/json': ['.json'] }, description: 'JSON' },
                            ]
                        });

                        return [handle, path] as const;
                    }

                    const { handle, path } = findFile(tree(), localEntry.id) ?? {};

                    return [handle, path] as const;
                })();

                console.log(k, path.join('.'));

                const createNewFile = async (lang: string, directory: FileSystemDirectoryHandle) => {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${lang}.json`,
                        startIn: directory,
                        excludeAcceptAllOption: true,
                        types: [
                            { accept: { 'application/json': ['.json'] }, description: 'JSON' },
                        ]
                    });
                };

                const key = k.slice(path.join('.').length);
                const { handle, path } = findFile(tree(), localEntry.id) ?? {};

                const result = match([handle !== undefined, mutation.kind])
                    .with([true, MutarionKind.Create], () => ({ action: MutarionKind.Create, key, value: rows[key][lang], handle }))
                    .with([false, MutarionKind.Create], () => '2')
                    .with([true, MutarionKind.Update], () => ({ action: MutarionKind.Update, key, value: rows[key][lang], handle }))
                    .with([false, MutarionKind.Update], () => '4')
                    .with([true, MutarionKind.Delete], () => ({ action: MutarionKind.Delete, key, handle }))
                    .with([false, MutarionKind.Delete], () => '6')
                    .exhaustive();

                console.log(mutation, key, lang, entry, result);
            }

            // for (const fileId of files) {
            //     const { path, meta } = findFile(tree(), fileId) ?? {};

            //     console.log(fileId, path, meta, entries());

            //     // TODO
            //     // - find file handle
            //     // - prepare data
            //     // -- clone entries map (so that order is preserved)
            //     // -- apply mutations
            //     // -- convert key to file local (ergo, remove the directory path prefix)
            //     // - write data to file
            // }
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

            <Sidebar as="aside" class={css.sidebar}>
                <Tree entries={tree().entries}>{
                    file => {
                        const mutated = createMemo(() => mutatedFiles().has(file().id));

                        return <Context.Handle><span classList={{ [css.mutated]: mutated() }}>{file().name}</span></Context.Handle>;
                    }
                }</Tree>
            </Sidebar>

            <Grid columns={columns()} rows={rows()} api={setApi} />
        </Context.Root>
    </div>
}