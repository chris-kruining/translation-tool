import { createCommand, Menu, Modifier } from "~/features/menu";
import { createEffect, createResource, createSignal, onMount } from "solid-js";
import { Entry, Grid, load, useFiles } from "~/features/file";
import "./edit.css";

interface RawEntry extends Record<string, RawEntry | string> { }

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
    const files = useFiles();
    const [root, { mutate, refetch }] = createResource(() => files.get('root'));
    const [columns, setColumns] = createSignal(['these', 'are', 'some', 'columns']);
    const [rows, setRows] = createSignal<Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>>(new Map);
    const [ctx, setCtx] = createSignal<any>();

    // Since the files are stored in indexedDb we need to refetch on the client in order to populate on page load
    onMount(() => {
        refetch();
    });

    createEffect(async () => {
        const directory = root();

        if (root.state === 'ready' && directory?.kind === 'directory') {
            const contents = await Array.fromAsync(walk(directory));

            const merged = contents.reduce((aggregate, { handle, path, lang, entries }) => {
                for (const [key, value] of entries.entries()) {
                    if (!aggregate.has(key)) {
                        aggregate.set(key, {});
                    }

                    aggregate.get(key)![lang] = { handle, value };
                }

                return aggregate;
            }, new Map<string, { [lang: string]: { value: string, handle: FileSystemFileHandle } }>());

            console.log(contents, merged);

            setColumns(['key', ...new Set(contents.map(c => c.lang))]);
            setRows(merged);
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
        selectAll: createCommand(() => {
            console.log(ctx()?.selectAll(true));
        }, { key: 'a', modifier: Modifier.Control }),
        view: createCommand(() => { }),
    } as const;

    return <>
        <Menu.Root>
            <Menu.Item label="file">
                <Menu.Item label="open" command={commands.open} />

                <Menu.Item label="open folder" command={commands.openFolder} />

                <Menu.Item label="save" command={commands.save} />

                <Menu.Item label="save all" command={commands.saveAll} />
            </Menu.Item>

            <Menu.Item label="edit" command={commands.edit} />

            <Menu.Item label="selection">
                <Menu.Item label="select all" command={commands.selectAll} />
            </Menu.Item>

            <Menu.Item label="view" command={commands.view} />
        </Menu.Root>

        <Grid columns={columns()} rows={rows()} context={setCtx} />
    </>
}
