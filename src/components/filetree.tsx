import { Accessor, Component, createContext, createSignal, For, JSX, Show, useContext } from "solid-js";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";
import { SelectionProvider, selectable } from "~/features/selectable";
import css from "./filetree.module.css";
import { debounce } from "~/utilities";

selectable;

export interface FileEntry {
    name: string;
    id: string;
    kind: 'file';
    handle: FileSystemFileHandle;
    directory: FileSystemDirectoryHandle;
    meta: File;
}

export interface FolderEntry {
    name: string;
    id: string;
    kind: 'folder';
    handle: FileSystemDirectoryHandle;
    entries: Entry[];
}

export type Entry = FileEntry | FolderEntry;

export const emptyFolder: FolderEntry = { name: '', id: '', kind: 'folder', entries: [], handle: undefined as unknown as FileSystemDirectoryHandle } as const;

export async function* walk(directory: FileSystemDirectoryHandle, filters: RegExp[] = [], depth = 0): AsyncGenerator<Entry, void, never> {
    if (depth === 10) {
        return;
    }

    for await (const handle of directory.values()) {
        if (filters.some(f => f.test(handle.name))) {
            continue;
        }

        const id = await handle.getUniqueId();

        if (handle.kind === 'file') {
            yield { name: handle.name, id, handle, kind: 'file', meta: await handle.getFile(), directory };
        }
        else {
            yield { name: handle.name, id, handle, kind: 'folder', entries: await Array.fromAsync(walk(handle, filters, depth + 1)) };
        }
    }
}

interface TreeContextType {
    open(file: File): void;
}

const TreeContext = createContext<TreeContextType>();

export const Tree: Component<{ entries: Entry[], children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element], open?: TreeContextType['open'] }> = (props) => {
    const [, setSelection] = createSignal<object[]>([]);

    const context = {
        open: props.open ?? (() => { }),
    };

    return <SelectionProvider selection={setSelection}>
        <TreeContext.Provider value={context}>
            <div class={css.root}><_Tree entries={props.entries} children={props.children} /></div>
        </TreeContext.Provider>
    </SelectionProvider>;
}

const _Tree: Component<{ entries: Entry[], children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element] }> = (props) => {
    const context = useContext(TreeContext);

    return <For each={props.entries.toSorted(sort_by('kind'))}>{
        entry => <>
            <Show when={entry.kind === 'folder' ? entry : undefined}>{
                folder => <Folder folder={folder()} children={props.children} />
            }</Show>

            <Show when={entry.kind === 'file' ? entry : undefined}>{
                file => <span use:selectable={{ key: file().id, value: file() }} ondblclick={() => context?.open(file().meta)}><AiFillFile /> {props.children[1](file)}</span>
            }</Show>
        </>
    }</For>
}

const Folder: Component<{ folder: FolderEntry, children: readonly [(folder: Accessor<FolderEntry>) => JSX.Element, (file: Accessor<FileEntry>) => JSX.Element] }> = (props) => {
    const [open, setOpen] = createSignal(true);

    return <details open={open()} ontoggle={() => debounce(() => setOpen(o => !o), 1)}>
        <summary><Show when={open()} fallback={<AiFillFolder />}><AiFillFolderOpen /></Show> {props.children[0](() => props.folder)}</summary>
        <_Tree entries={props.folder.entries} children={props.children} />
    </details>;
};

const sort_by = (key: string) => (objA: Record<string, any>, objB: Record<string, any>) => {
    const a = objA[key];
    const b = objB[key];

    return Number(a < b) - Number(b < a);
};