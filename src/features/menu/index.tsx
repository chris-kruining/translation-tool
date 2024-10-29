import { Accessor, Component, For, JSX, Match, ParentComponent, Setter, Show, Switch, children, createContext, createEffect, createMemo, createSignal, createUniqueId, mergeProps, onCleanup, onMount, useContext } from "solid-js";
import { Portal } from "solid-js/web";
import { createStore } from "solid-js/store";
import { CommandType, Command } from "../command";
import css from "./index.module.css";

export interface MenuContextType {
    ref: Accessor<Node | undefined>;
    setRef: Setter<Node | undefined>;

    addItems(items: (Item | Separator | ItemWithChildren)[]): void;
    items: Accessor<(Item | Separator | ItemWithChildren)[]>;
    commands(): CommandType[];
};

export interface Item {
    kind: 'leaf';
    id: string;
    label: string;
    command: CommandType;
}

export interface Separator {
    kind: 'separator';
}

export interface ItemWithChildren {
    kind: 'node';
    id: string;
    label: string;
    children: (Item | Separator)[];
}

const MenuContext = createContext<MenuContextType>();

export const MenuProvider: ParentComponent<{ commands?: CommandType[] }> = (props) => {
    const [ref, setRef] = createSignal<Node | undefined>();
    const [store, setStore] = createStore<{ items: Record<string, Item | ItemWithChildren> }>({ items: {} });

    const ctx = {
        ref,
        setRef,
        addItems(items: (Item | ItemWithChildren)[]) {
            return setStore('items', values => {
                for (const item of items) {
                    values[item.id] = item;
                }

                return values;
            })
        },
        items() {
            return Object.values(store.items);
        },
        commands() {
            return Object.values(store.items)
                .map(item => item.kind === 'node' ? item.children.filter(c => c.kind === 'leaf').map(c => c.command) : item.command)
                .flat()
                .concat(props.commands ?? []);
        },
    };

    return <Command.Root commands={ctx.commands()}>
        <MenuContext.Provider value={ctx}>{props.children}</MenuContext.Provider>
    </Command.Root>;
}

const useMenu = () => {
    const context = useContext(MenuContext);

    if (context === undefined) {
        throw new Error(`MenuContext is called outside of a <MenuProvider />`);
    }

    return context;
}

type ItemProps = { label: string, children: JSX.Element } | { command: CommandType };

const Item: Component<ItemProps> = (props) => {
    const id = createUniqueId();

    if (props.command) {
        return mergeProps(props, { id, kind: 'leaf' }) as unknown as JSX.Element;
    }

    const childItems = children(() => props.children);

    return mergeProps(props, {
        id,
        kind: 'node',
        get children() {
            return childItems.toArray();
        }
    }) as unknown as JSX.Element;
}

const Separator: Component = (props) => {
    return mergeProps(props, { kind: 'separator' }) as unknown as JSX.Element;
}

const Root: ParentComponent<{}> = (props) => {
    const menu = useMenu();
    const [current, setCurrent] = createSignal<HTMLElement>();
    const items = children(() => props.children).toArray() as unknown as (Item | ItemWithChildren)[];

    menu.addItems(items)

    const close = () => {
        const el = current();

        if (el) {
            el.hidePopover();

            setCurrent(undefined);
        }
    };

    const onExecute = (command?: CommandType) => {
        return command
            ? async () => {
                await command?.();

                close();
            }
            : () => { }
    };

    const Child: Component<{ command: CommandType }> = (props) => {
        return <button class={css.item} type="button" onpointerdown={onExecute(props.command)}>
            <Command.Handle command={props.command} />
        </button>
    };

    return <Portal mount={menu.ref()}>
        <For each={items}>{
            item => <Switch>
                <Match when={item.kind === 'node' ? item as ItemWithChildren : undefined}>{
                    item => <>
                        <div
                            class={css.child}
                            id={`child-${item().id}`}
                            style={`position-anchor: --menu-${item().id};`}
                            popover
                            on:toggle={(e: ToggleEvent) => {
                                if (e.newState === 'open' && e.target !== null) {
                                    return setCurrent(e.target as HTMLElement);
                                }
                            }}
                        >
                            <For each={item().children}>{
                                child => <Switch>
                                    <Match when={child.kind === 'leaf' ? child as Item : undefined}>{
                                        item => <Child command={item().command} />
                                    }</Match>

                                    <Match when={child.kind === 'separator'}><hr class={css.separator} /></Match>
                                </Switch>
                            }</For>
                        </div>

                        <button
                            class={css.item}
                            type="button"
                            popovertarget={`child-${item().id}`}
                            style={`anchor-name: --menu-${item().id};`}
                        >
                            {item().label}
                        </button>
                    </>
                }</Match>

                <Match when={item.kind === 'leaf' ? item as Item : undefined}>{
                    item => <Child command={item().command} />
                }</Match>
            </Switch>
        }</For>
    </Portal>
};

const Mount: Component = (props) => {
    const menu = useMenu();

    return <div class={css.root} ref={menu.setRef} />;
};

export const Menu = { Mount, Root, Item, Separator } as const;

export interface CommandPaletteApi {
    readonly open: Accessor<boolean>;
    show(): void;
    hide(): void;
}

export const CommandPalette: Component<{ api?: (api: CommandPaletteApi) => any, onSubmit?: SubmitHandler<CommandType> }> = (props) => {
    const [open, setOpen] = createSignal<boolean>(false);
    const [root, setRoot] = createSignal<HTMLDialogElement>();
    const [search, setSearch] = createSignal<SearchContext<CommandType>>();
    const context = useMenu();

    const api = {
        open,
        show() {
            setOpen(true);
        },
        hide() {
            setOpen(false);
        },
    };

    createEffect(() => {
        props.api?.(api);
    });


    createEffect(() => {
        const isOpen = open();

        if (isOpen) {
            search()?.clear();
            root()?.showModal();
        } else {
            root()?.close();
        }
    });

    const onSubmit = (command: CommandType) => {
        setOpen(false);
        props.onSubmit?.(command);

        command();
    };

    return <dialog ref={setRoot} class={css.commandPalette} onClose={() => setOpen(false)}>
        <SearchableList<CommandType> items={context.commands()} keySelector={item => item.label} context={setSearch} onSubmit={onSubmit}>{
            (item, ctx) => <For each={item.label.split(ctx.filter())}>{
                (part, index) => <>
                    <Show when={index() !== 0}><b>{ctx.filter()}</b></Show>
                    {part}
                </>
            }</For>
        }</SearchableList>
    </dialog>;
};

interface SubmitHandler<T> {
    (item: T): any;
}

interface SearchContext<T> {
    readonly filter: Accessor<string>;
    readonly results: Accessor<T[]>;
    readonly value: Accessor<T | undefined>;
    searchFor(term: string): void;
    clear(): void;
}

interface SearchableListProps<T> {
    items: T[];
    keySelector(item: T): string;
    filter?: (item: T, search: string) => boolean;
    children(item: T, context: SearchContext<T>): JSX.Element;
    context?: (context: SearchContext<T>) => any,
    onSubmit?: SubmitHandler<T>;
}

function SearchableList<T>(props: SearchableListProps<T>): JSX.Element {
    const [term, setTerm] = createSignal<string>('');
    const [input, setInput] = createSignal<HTMLInputElement>();
    const [selected, setSelected] = createSignal<number>(0);
    const id = createUniqueId();

    const results = createMemo(() => {
        const search = term();

        if (search === '') {
            return [];
        }

        return props.items.filter(item => props.filter ? props.filter(item, search) : props.keySelector(item).includes(search));
    });

    const value = createMemo(() => results().at(selected()));

    const ctx = {
        filter: term,
        results,
        value,
        searchFor(term: string) {
            setTerm(term);
        },
        clear() {
            setTerm('');
            setSelected(0);
        },
    };

    createEffect(() => {
        props.context?.(ctx);
    });

    createEffect(() => {
        const length = results().length - 1;

        setSelected(current => current !== undefined ? Math.min(current, length) : undefined);
    });

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            setSelected(current => Math.max(0, current - 1));

            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            setSelected(current => Math.min(results().length - 1, current + 1));

            e.preventDefault();
        }
    };

    const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();

        const v = value();

        if (v === undefined) {
            return;
        }

        ctx.clear();
        props.onSubmit?.(v);
    };

    return <form method="dialog" class={css.search} onkeydown={onKeyDown} onsubmit={onSubmit}>
        <input id={`search-${id}`} ref={setInput} value={term()} oninput={(e) => setTerm(e.target.value)} placeholder="start typing for command" autofocus autocomplete="off" />

        <output for={`search-${id}`}>
            <For each={results()}>{
                (result, index) => <div classList={{ [css.selected]: index() === selected() }}>{props.children(result, ctx)}</div>
            }</For>
        </output>
    </form>;
};

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            anchor?: string | undefined;
        }
    }
}