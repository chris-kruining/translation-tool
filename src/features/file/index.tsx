import Dexie, { EntityTable } from "dexie";
import { createContext, ParentComponent, useContext } from "solid-js";
import { isServer } from "solid-js/web";
import * as json from './parser/json';

interface FileEntity {
    name: string;
    handle: FileSystemDirectoryHandle;
}

type Store = Dexie & {
    files: EntityTable<FileEntity, 'name'>;
};

interface FilesContextType {
    set(name: string, handle: FileSystemDirectoryHandle): Promise<void>;
    get(name: string): Promise<FileSystemDirectoryHandle | undefined>;
    list(): Promise<FileSystemDirectoryHandle[]>;
}

const FilesContext = createContext<FilesContextType>();

const clientContext = (): FilesContextType => {
    const db = new Dexie('Files') as Store;

    db.version(1).stores({
        files: 'name, handle'
    });

    return {
        async set(name: string, handle: FileSystemDirectoryHandle) {
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
        return Promise.resolve<FileSystemDirectoryHandle[]>([]);
    },
});

export const FilesProvider: ParentComponent = (props) => {
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