import Dexie, { EntityTable } from "dexie";
import { Accessor, createContext, createMemo, onMount, ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import * as json from './parser/json';

const ROOT = '__root__';

interface FileEntity {
    key: string;
    handle: FileSystemDirectoryHandle;
}

type Store = Dexie & {
    files: EntityTable<FileEntity, 'key'>;
};

interface InternalFilesContextType {
    onChange(hook: (key: string, handle: FileSystemDirectoryHandle) => any): void;
    set(key: string, handle: FileSystemDirectoryHandle): Promise<void>;
    get(key: string): Promise<FileSystemDirectoryHandle | undefined>;
    remove(key: string): Promise<void>;
    keys(): Promise<string[]>;
    entries(): Promise<FileEntity[]>;
    list(): Promise<FileSystemDirectoryHandle[]>;
}

interface FilesContextType {
    readonly files: Accessor<FileEntity[]>,
    readonly root: Accessor<FileSystemDirectoryHandle | undefined>,

    open(directory: FileSystemDirectoryHandle): void;
    get(key: string): Accessor<FileSystemDirectoryHandle | undefined>
    set(key: string, handle: FileSystemDirectoryHandle): Promise<void>;
    remove(key: string): Promise<void>;
}

const FilesContext = createContext<FilesContextType>();

const clientContext = (): InternalFilesContextType => {
    const db = new Dexie('Files') as Store;

    db.version(1).stores({
        files: 'key, handle'
    });

    return {
        onChange(hook: (key: string, handle: FileSystemDirectoryHandle) => any) {
            const callHook = (key: string, handle: FileSystemDirectoryHandle) => {
                if (!key || key === ROOT) {
                    return;
                }

                setTimeout(() => hook(key, handle), 1);
            };

            db.files.hook('creating', (_: string, { key, handle }: FileEntity) => { callHook(key, handle); });
            db.files.hook('deleting', (_: string, { key, handle }: FileEntity = { key: undefined!, handle: undefined! }) => callHook(key, handle));
            db.files.hook('updating', (_1: Object, _2: string, { key, handle }: FileEntity) => callHook(key, handle));
        },

        async set(key: string, handle: FileSystemDirectoryHandle) {
            await db.files.put({ key, handle });
        },
        async get(key: string) {
            return (await db.files.get(key))?.handle;
        },
        async remove(key: string) {
            return (await db.files.delete(key));
        },
        async keys() {
            return (await db.files.where('key').notEqual(ROOT).toArray()).map(f => f.key);
        },
        async entries() {
            return await db.files.where('key').notEqual(ROOT).toArray();
        },
        async list() {
            const files = await db.files.where('key').notEqual(ROOT).toArray();

            return files.map(f => f.handle)
        },
    }
};

const serverContext = (): InternalFilesContextType => ({
    onChange(hook: (key: string, handle: FileSystemDirectoryHandle) => any) {

    },
    set(key: string, handle: FileSystemDirectoryHandle) {
        return Promise.resolve();
    },
    get(key: string) {
        return Promise.resolve(undefined);
    },
    remove(key: string) {
        return Promise.resolve(undefined);
    },
    keys() {
        return Promise.resolve([]);
    },
    entries() {
        return Promise.resolve([]);
    },
    list() {
        return Promise.resolve([]);
    },
});

export const FilesProvider: ParentComponent = (props) => {
    const internal = isServer ? serverContext() : clientContext();

    const [state, setState] = createStore<{ openedFiles: FileEntity[], root: FileSystemDirectoryHandle | undefined }>({ openedFiles: [], root: undefined });

    internal.onChange(async () => {
        setState('openedFiles', await internal.entries());
    });

    onMount(() => {
        (async () => {
            const [root, files] = await Promise.all([
                internal.get(ROOT),
                internal.entries(),
            ]);

            setState('root', root);
            setState('openedFiles', files);
        })();
    });

    const context: FilesContextType = {
        files: createMemo(() => state.openedFiles),
        root: createMemo(() => state.root),

        open(directory: FileSystemDirectoryHandle) {
            setState('root', directory);
            internal.set(ROOT, directory);
        },

        get(key: string): Accessor<FileSystemDirectoryHandle | undefined> {
            return createMemo(() => state.openedFiles.find(entity => entity.key === key)?.handle);
        },

        async set(key: string, handle: FileSystemDirectoryHandle) {
            await internal.set(key, handle);
        },

        async remove(key: string) {
            await internal.remove(key);
        },
    };

    return <FilesContext.Provider value={context}>{props.children}</FilesContext.Provider>;
}

export const useFiles = () => useContext(FilesContext)!;

export const load = (file: File): Promise<Map<string, string> | undefined> => {
    switch (file.type) {
        case 'application/json': return json.load(file.stream())

        default: return Promise.resolve(undefined);
    }
};

export { Grid } from './grid';
export type { Entry } from './grid';