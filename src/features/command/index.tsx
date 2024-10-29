import { Accessor, children, Component, createContext, createEffect, createMemo, JSX, ParentComponent, ParentProps, Show, useContext } from 'solid-js';

interface CommandContextType {
    set(commands: CommandType<any[]>[]): void;
    addContextualArguments<T extends any[] = any[]>(command: CommandType<T>, target: EventTarget, args: Accessor<T>): void;
    execute<TArgs extends any[] = []>(command: CommandType<TArgs>, event: Event): void;
}

const CommandContext = createContext<CommandContextType>();

export const useCommands = () => useContext(CommandContext);

const Root: ParentComponent<{ commands: CommandType[] }> = (props) => {
    // const commands = () => props.commands ?? [];
    const contextualArguments = new Map<CommandType, WeakMap<EventTarget, Accessor<any[]>>>();
    const commands = new Set<CommandType<any[]>>();

    const context = {
        set(c: CommandType<any[]>[]): void {
            for (const command of c) {
                commands.add(command);
            }
        },

        addContextualArguments<T extends any[] = any[]>(command: CommandType<T>, target: EventTarget, args: Accessor<T>): void {
            if (contextualArguments.has(command) === false) {
                contextualArguments.set(command, new WeakMap());
            }

            contextualArguments.get(command)?.set(target, args);
        },

        execute<T extends any[] = any[]>(command: CommandType<T>, event: Event): boolean | undefined {
            const contexts = contextualArguments.get(command);

            if (contexts === undefined) {
                return;
            }

            const element = event.composedPath().find(el => contexts.has(el));

            if (element === undefined) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const args = contexts.get(element)! as Accessor<T>;

            command(...args());

            return false;
        },
    };

    createEffect(() => {
        context.set(props.commands ?? []);
    });

    const listener = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        const modifiers =
            (e.shiftKey ? 1 : 0) << 0 |
            (e.ctrlKey ? 1 : 0) << 1 |
            (e.metaKey ? 1 : 0) << 2 |
            (e.altKey ? 1 : 0) << 3;

        const command = commands.values().find(c => c.shortcut?.key === key && (c.shortcut.modifier === undefined || c.shortcut.modifier === modifiers));

        if (command === undefined) {
            return;
        }

        return context.execute(command, e);
    };

    return <CommandContext.Provider value={context}>
        <div tabIndex={0} style="display: contents;" onKeyDown={listener}>{props.children}</div>
    </CommandContext.Provider>;
};

const Add: Component<{ command: CommandType<any[]> } | { commands: CommandType<any[]>[] }> = (props) => {
    const context = useCommands();
    const commands = createMemo<CommandType<any[]>[]>(() => props.commands ?? [props.command]);

    createEffect(() => {
        context?.set(commands());
    });

    return undefined;
};

const Context = <T extends any[] = any[]>(props: ParentProps<{ for: CommandType<T>, with: T }>): JSX.Element => {
    const resolved = children(() => props.children);
    const context = useCommands();
    const args = createMemo(() => props.with);

    createEffect(() => {
        const children = resolved();

        if (Array.isArray(children) || !(children instanceof Element)) {
            return;
        }

        context?.addContextualArguments(props.for, children, args);
    });

    return <>{resolved()}</>;
};

const Handle: Component<{ command: CommandType }> = (props) => {
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

export const Command = { Root, Handle, Add, Context };

export enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface CommandType<TArgs extends any[] = []> {
    (...args: TArgs): any;
    label: string;
    shortcut?: {
        key: string;
        modifier: Modifier;
    };
}

export const createCommand = <TArgs extends any[] = []>(label: string, command: (...args: TArgs) => any, shortcut?: CommandType['shortcut']): CommandType<TArgs> => {
    return Object.defineProperties(command as CommandType<TArgs>, {
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

export const commandArguments = <T extends any[] = any[]>(element: Element, commandAndArgs: Accessor<[CommandType<T>, T]>) => {
    const ctx = useContext(CommandContext);
    const args = createMemo(() => commandAndArgs()[1]);

    if (!ctx) {
        return;
    }

    ctx.addContextualArguments(commandAndArgs()[0], element, args);
}

export const noop = Object.defineProperties(createCommand('noop', () => { }), {
    withLabel: {
        value(label: string) {
            return createCommand(label, () => { });
        },
        configurable: false,
        writable: false,
    },
}) as CommandType & { withLabel(label: string): CommandType };

declare module "solid-js" {
    namespace JSX {
        interface Directives {
            commandArguments<T extends any[] = any[]>(): [CommandType<T>, T];
        }
    }
}

export { Context } from './contextMenu';