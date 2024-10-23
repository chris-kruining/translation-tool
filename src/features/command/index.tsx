import { Component, Show } from 'solid-js';

export enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface CommandType {
    (): any;
    label: string;
    shortcut?: {
        key: string;
        modifier: Modifier;
    };
}

export const createCommand = (label: string, command: () => any, shortcut?: CommandType['shortcut']): CommandType => {
    return Object.defineProperties(command as CommandType, {
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

export const noop = Object.defineProperties(createCommand('noop', () => { }), {
    withLabel: {
        value(label: string) {
            return createCommand(label, () => { });
        },
        configurable: false,
        writable: false,
    },
}) as CommandType & { withLabel(label: string): CommandType };

export const Command: Component<{ command: CommandType }> = (props) => {
    return <>
        {props.command.label}
        <Show when={props.command.shortcut}>{
            shortcut => {
                const shift = shortcut().modifier & Modifier.Shift ? 'Shft+' : '';
                const ctrl = shortcut().modifier & Modifier.Control ? 'Ctrl+' : '';
                const meta = shortcut().modifier & Modifier.Meta ? 'Meta+' : '';
                const alt = shortcut().modifier & Modifier.Alt ? 'Alt+' : '';

                return <sub>{ctrl}{shift}{meta}{alt}{shortcut().key}</sub>;
            }
        }</Show>
    </>;
};

export { Context } from './contextMenu';