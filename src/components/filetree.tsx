import { Accessor, Component, createContext, createSignal, For, JSX, Show, useContext } from "solid-js";
import css from "./filetree.module.css";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";
import { SelectionProvider, selectable } from "~/features/selectable";

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

interface TreeContextType {
    open(file: File): void;
}

const TreeContext = createContext<TreeContextType>();

export const Tree: Component<{ entries: Entry[], children: (file: Accessor<FileEntry>) => JSX.Element, open: TreeContextType['open'] }> = (props) => {
    const [selection, setSelection] = createSignal();

    // createEffect(() => {
    //   console.log(selection());
    // });

    const context = {
        open: props.open,
        // open(file: File) {
        //     console.log(`open ${file.name}`)
        // },
    };

    return <SelectionProvider selection={setSelection}>
        <TreeContext.Provider value={context}>
            <div class={css.root}><_Tree entries={props.entries} children={props.children} /></div>
        </TreeContext.Provider>
    </SelectionProvider>;
}

const _Tree: Component<{ entries: Entry[], children: (file: Accessor<FileEntry>) => JSX.Element }> = (props) => {
    const context = useContext(TreeContext);

    return <For each={props.entries.sort(sort_by('kind'))}>{
        entry => <>
            <Show when={entry.kind === 'folder' ? entry : undefined}>{
                folder => <Folder folder={folder()} children={props.children} />
            }</Show>

            <Show when={entry.kind === 'file' ? entry : undefined}>{
                file => <span use:selectable={file()} ondblclick={() => context?.open(file().meta)}><AiFillFile /> {props.children(file)}</span>
            }</Show>
        </>
    }</For>
}

const Folder: Component<{ folder: FolderEntry, children: (file: Accessor<FileEntry>) => JSX.Element }> = (props) => {
    const [open, setOpen] = createSignal(false);

    return <details open={open()} ontoggle={() => setOpen(o => !o)}>
        <summary><Show when={open()} fallback={<AiFillFolder />}><AiFillFolderOpen /></Show> {props.folder.name}</summary>
        <_Tree entries={props.folder.entries} children={props.children} />
    </details>;
};

const sort_by = (key: string) => (objA: Record<string, any>, objB: Record<string, any>) => {
    const a = objA[key];
    const b = objB[key];

    return Number(a < b) - Number(b < a);
};