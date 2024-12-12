

interface FileSystemHandle {
    getUniqueId(): Promise<string>;
}

declare module "solid-js" {
    namespace JSX {
        interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
            indeterminate?: boolean;
        }
    }
}