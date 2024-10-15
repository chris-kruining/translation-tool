import { Menu } from "~/features/menu";
import { Sidebar } from "~/components/sidebar";
import { Component, createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { Grid, load, useFiles } from "~/features/file";
import { createCommand, Modifier, noop } from "~/features/command";
import { GridContextType } from "~/features/file/grid";
import css from "./edit.module.css";
import { emptyFolder, FolderEntry, walk as fileTreeWalk, Tree } from "~/components/filetree";

async function* walk(directory: FileSystemDirectoryHandle, path: string[] = []): AsyncGenerator<{ handle: FileSystemFileHandle, path: string[], lang: string, entries: Map<string, string> }, void, never> {
    for await (const handle of directory.values()) {
        if (handle.kind === 'directory') {
            yield* walk(handle, [...path, handle.name]);

            continue;
        }

        if (!handle.name.endsWith('.json')) {
            continue;
        }

        const file = await handle.getFile();
        const lang = file.name.split('.').at(0)!;
        const entries = await load(file);

        if (entries !== undefined) {
            yield { handle, path, lang, entries };
        }
    }
};

export default function Edit(props) {
    const filesContext = useFiles();
    const [root, { mutate, refetch }] = createResource(() => filesContext.get('root'));
    const [tree, setFiles] = createSignal<FolderEntry>(emptyFolder);
    const [columns, setColumns] = createSignal(['these', 'are', 'some', 'columns']);
    const [rows, setRows] = createSignal<Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>>(new Map);
    const [ctx, setCtx] = createSignal<GridContextType>();

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

            const merged = contents.reduce((aggregate, { handle, path, lang, entries }) => {
                for (const [key, value] of entries.entries()) {
                    const k = [...path, key].join('.');

                    if (!aggregate.has(k)) {
                        aggregate.set(k, Object.fromEntries(template));
                    }

                    aggregate.get(k)![lang] = { handle, value };
                }

                return aggregate;
            }, new Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>());

            setFiles({ name: '', kind: 'folder', entries: await Array.fromAsync(fileTreeWalk(directory)) });
            setColumns(['key', ...languages]);
            setRows(merged);
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
        openFolder: createCommand('open', async () => {
            const directory = await window.showDirectoryPicker({ mode: 'readwrite' });

            filesContext.set('root', directory);
            mutate(directory);
        }),
        save: createCommand('save', () => {
            console.log('save', rows());
        }, { key: 's', modifier: Modifier.Control }),
        saveAs: createCommand('saveAs', () => {
            console.log('save as ...');
        }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
        edit: createCommand('edit', () => {
        }),
        selectAll: createCommand('selectAll', () => {
            console.log(ctx(), ctx()?.selection.selectAll(true));
        }, { key: 'a', modifier: Modifier.Control }),
    } as const;

    const mutated = createMemo(() => Object.values(ctx()?.rows ?? {}).filter(row => Object.values(row).some(lang => lang.original !== lang.value)));

    createEffect(() => {
        console.log('KAAS', mutated());
    });

    return <div class={css.root}>
        <Menu.Root>
            <Menu.Item label="file">
                <Menu.Item label="open" command={commands.open} />

                <Menu.Item label="open folder" command={commands.openFolder} />

                <Menu.Item label="save" command={commands.save} />

                <Menu.Item label="save all" command={commands.saveAs} />
            </Menu.Item>

            <Menu.Item label="edit" command={commands.edit} />

            <Menu.Item label="selection">
                <Menu.Item label="select all" command={commands.selectAll} />
            </Menu.Item>

            <Menu.Item label="view" command={noop} />
        </Menu.Root>

        <Sidebar as="aside">
            <Tree entries={tree().entries}>{
                (file, icon) => <span>{icon} {file().name}</span>
            }</Tree>
        </Sidebar>

        <Grid columns={columns()} rows={rows()} context={setCtx} />
    </div>
}