import { Accessor, Component, createSignal, For, JSX, Show } from "solid-js";
import css from "./filetree.module.css";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";

export interface FileEntry {
    name: string;
    kind: 'file';
    meta: File;
}

export interface FolderEntry {
    name: string;
    kind: 'folder';
    entries: Entry[];
}

export type Entry = FileEntry | FolderEntry;

export const emptyFolder: FolderEntry = { name: '', kind: 'folder', entries: [] } as const;

export async function* walk(directory: FileSystemDirectoryHandle, filters: RegExp[] = [], depth = 0): AsyncGenerator<Entry, void, never> {
    if (depth === 10) {
        return;
    }

    for await (const handle of directory.values()) {

        if (filters.some(f => f.test(handle.name))) {
            continue;
        }

        if (handle.kind === 'file') {
            yield { name: handle.name, kind: 'file', meta: await handle.getFile() };
        }
        else {
            yield { name: handle.name, kind: 'folder', entries: await Array.fromAsync(walk(handle, filters, depth + 1)) };
        }
    }
}

export const Tree: Component<{ entries: Entry[], children: (file: Accessor<FileEntry>) => JSX.Element }> = (props) => {
    return <ul class={css.root}>
        <For each={props.entries}>{
            (entry, index) => <li style={`order: ${(entry.kind === 'file' ? 200 : 100) + index()}`}>
                <Show when={entry.kind === 'folder' ? entry : undefined}>{
                    folder => <Folder folder={folder()} children={props.children} />
                }</Show>

                <Show when={entry.kind === 'file' ? entry : undefined}>{
                    file => <><AiFillFile />{props.children(file)}</>
                }</Show>
            </li>
        }</For>
    </ul>
}

const Folder: Component<{ folder: FolderEntry, children: (file: Accessor<FileEntry>) => JSX.Element }> = (props) => {
    const [open, setOpen] = createSignal(false);

    return <details open={open()} on:toggle={() => setOpen(o => !o)}>
        <summary><Show when={open()} fallback={<AiFillFolder />}><AiFillFolderOpen /></Show> {props.folder.name}</summary>
        <Tree entries={props.folder.entries} children={props.children} />
    </details>;
};