import { Menu } from "~/features/menu";
import { Sidebar } from "~/components/sidebar";
import { Component, createEffect, createMemo, createResource, createSignal, onMount, ParentComponent, ParentProps } from "solid-js";
import { Grid, load, useFiles } from "~/features/file";
import { Command, Context, createCommand, Modifier, noop } from "~/features/command";
import { GridApi } from "~/features/file/grid";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree, FileEntry } from "~/components/filetree";
import css from "./edit.module.css";
import { splitAt } from "~/utilities";

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

export default function Edit(props: ParentProps) {
    const filesContext = useFiles();
    const [root, { mutate, refetch }] = createResource(() => filesContext?.get('root'));
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);
    const [columns, setColumns] = createSignal<string[]>([]);
    const [rows, setRows] = createSignal<Map<string, Record<string, string>>>(new Map);
    const [entries, setEntries] = createSignal<Map<string, Record<string, { id: String, value: string, handle: FileSystemFileHandle }>>>(new Map);
    const [api, setApi] = createSignal<GridApi>();

    const mutatedFiles = createMemo(() => {
        const mutations = api()?.mutations() ?? [];
        const files = entries();

        return new Set(mutations
            .map(mutation => {
                const [key, lang] = splitAt(mutation.key, mutation.key.lastIndexOf('.'));

                return files.get(key)?.[lang]?.id;
            })
            .filter(Boolean)
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

    createEffect(() => {
        mutatedFiles()
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
        save: createCommand('save', () => {
            console.log('save');
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