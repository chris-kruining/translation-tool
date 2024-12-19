import { Accessor, children, Component, createContext, createEffect, createMemo, For, JSX, ParentComponent, ParentProps, Show, useContext } from 'solid-js';

interface CommandContextType {
    set(commands: CommandType<any>[]): void;
    addContextualArguments<T extends (...args: any[]) => any = any>(command: CommandType<T>, target: EventTarget, args: Accessor<Parameters<T>>): void;
    execute<T extends (...args: any[]) => any = any>(command: CommandType<T>, event: Event): void;
}

const CommandContext = createContext<CommandContextType>();

export const useCommands = () => useContext(CommandContext);

const Root: ParentComponent<{ commands: CommandType[] }> = (props) => {
    // const commands = () => props.commands ?? [];
    const contextualArguments = new Map<CommandType, WeakMap<EventTarget, Accessor<any[]>>>();
    const commands = new Set<CommandType<any>>();

    const context = {
        set(c: CommandType<any>[]): void {
            for (const command of c) {
                commands.add(command);
            }
        },

        addContextualArguments<T extends (...args: any[]) => any = any>(command: CommandType<T>, target: EventTarget, args: Accessor<Parameters<T>>): void {
            if (contextualArguments.has(command) === false) {
                contextualArguments.set(command, new WeakMap());
            }

            contextualArguments.get(command)?.set(target, args);
        },

        execute<T extends (...args: any[]) => any = any>(command: CommandType<T>, event: Event): boolean | undefined {
            const args = ((): Parameters<T> => {

                const contexts = contextualArguments.get(command);

                if (contexts === undefined) {
                    return [] as any;
                }

                const element = event.composedPath().find(el => contexts.has(el));

                if (element === undefined) {
                    return [] as any;
                }

                const args = contexts.get(element)! as Accessor<Parameters<T>>;

                return args();
            })();

            event.preventDefault();
            event.stopPropagation();

            command(...args);

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

const Add: Component<{ command: CommandType<any> } | { commands: CommandType<any>[] }> = (props) => {
    const context = useCommands();
    const commands = createMemo<CommandType<any>[]>(() => props.commands ?? [props.command]);

    createEffect(() => {
        context?.set(commands());
    });

    return undefined;
};

const Context = <T extends (...args: any[]) => any = any>(props: ParentProps<{ for: CommandType<T>, with: Parameters<T> }>): JSX.Element => {
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
    return <samp>
        {props.command.label}
        <Show when={props.command.shortcut}>{
            shortcut => {
                const modifier = shortcut().modifier;
                const modifierMap: Record<number, string> = {
                    [Modifier.Shift]: 'Shft',
                    [Modifier.Control]: 'Ctrl',
                    [Modifier.Meta]: 'Meta',
                    [Modifier.Alt]: 'Alt',
                };

                return <>&nbsp;
                    <For each={Object.values(Modifier).filter((m): m is number => typeof m === 'number').filter(m => modifier & m)}>{
                        (m) => <><kbd>{modifierMap[m]}</kbd>+</>
                    }</For>
                    <kbd>{shortcut().key}</kbd>
                </>;
            }
        }</Show>
    </samp>;
};

export const Command = { Root, Handle, Add, Context };

export enum Modifier {
    None = 0,
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface CommandType<T extends (...args: any[]) => any = any> {
    (...args: Parameters<T>): Promise<ReturnType<T>>;
    label: string;
    shortcut?: {
        key: string;
        modifier: Modifier;
    };
    withLabel(label: string): CommandType<T>;
    with<A extends any[], B extends any[]>(this: (this: ThisParameterType<T>, ...args: [...A, ...B]) => ReturnType<T>, ...args: A): CommandType<(...args: B) => ReturnType<T>>;
}

export const createCommand = <T extends (...args: any[]) => any>(label: string, command: T, shortcut?: CommandType['shortcut']): CommandType<T> => {
    return Object.defineProperties(((...args: Parameters<T>) => command(...args)) as any, {
        label: {
            value: label,
            configurable: false,
            writable: false,
        },
        shortcut: {
            value: shortcut ? { key: shortcut.key.toLowerCase(), modifier: shortcut.modifier } : undefined,
            configurable: false,
            writable: false,
        },
        withLabel: {
            value(label: string) {
                return createCommand(label, command, shortcut);
            },
            configurable: false,
            writable: false,
        },
        with: {
            value<A extends any[], B extends any[]>(this: (this: ThisParameterType<T>, ...args: [...A, ...B]) => ReturnType<T>, ...args: A): CommandType<(...args: B) => ReturnType<T>> {
                return createCommand(label, command.bind(undefined, ...args), shortcut);
            },
            configurable: false,
            writable: false,
        }
    });
};

export const noop = createCommand('noop', () => { });

export { Context } from './contextMenu';