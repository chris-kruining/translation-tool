import Dexie, { EntityTable } from "dexie";
import { createContext, useContext } from "solid-js";
import { isServer } from "solid-js/web";
import * as json from './parser/json';

type Handle = FileSystemFileHandle | FileSystemDirectoryHandle;

interface FileEntity {
    name: string;
    handle: Handle;
}

type Store = Dexie & {
    files: EntityTable<FileEntity, 'name'>;
};

interface FilesContextType {
    set(name: string, handle: Handle): Promise<void>;
    get(name: string): Promise<Handle | undefined>;
    list(): Promise<Handle[]>;
}

const FilesContext = createContext<FilesContextType>();

const clientContext = (): FilesContextType => {
    const db = new Dexie('Files') as Store;

    db.version(1).stores({
        files: 'name, handle'
    });

    return {
        async set(name: string, handle: Handle) {
            await db.files.put({ name, handle });
        },
        async get(name: string) {
            return (await db.files.get(name))?.handle;
        },
        async list() {
            const files = await db.files.toArray();

            return files.map(f => f.handle)
        },
    }
};

const serverContext = (): FilesContextType => ({
    set() {
        return Promise.resolve();
    },
    get(name: string) {
        return Promise.resolve(undefined);
    },
    list() {
        return Promise.resolve<Handle[]>([]);
    },
});

export const FilesProvider = (props) => {
    const ctx = isServer ? serverContext() : clientContext();

    return <FilesContext.Provider value={ctx}>{props.children}</FilesContext.Provider>;
}

export const useFiles = () => useContext(FilesContext);

export const load = (file: File): Promise<Map<string, string> | undefined> => {
    switch (file.type) {
        case 'application/json': return json.load(file.stream())

        default: return Promise.resolve(undefined);
    }
};

export { Grid } from './grid';
export type { Entry } from './grid';