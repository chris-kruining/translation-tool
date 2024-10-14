export enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface Command {
    (): any;
    label: string;
    shortcut?: {
        key: string;
        modifier: Modifier;
    };
}

export const createCommand = (label: string, command: () => any, shortcut?: Command['shortcut']): Command => {
    return Object.defineProperties(command as Command, {
        label: {
            value: label,
            configurable: false,
            writable: false,
        },
        shortcut: {
            value: shortcut ? { key: shortcut.key.toLowerCase(), modifier: shortcut.modifier } : undefined,
            configurable: false,
            writable: false,
        }
    });
};

export const noop = createCommand('noop', () => { });