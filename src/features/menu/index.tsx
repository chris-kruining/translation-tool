import { Accessor, Component, For, JSX, ParentComponent, Setter, Show, children, createContext, createEffect, createMemo, createSignal, createUniqueId, mergeProps, onCleanup, onMount, useContext } from "solid-js";
import { Portal } from "solid-js/web";
import { createStore } from "solid-js/store";
import { CommandType, Command } from "../command";
import css from "./index.module.css";
import { join } from "vinxi/dist/types/lib/path";

export interface MenuContextType {
    ref: Accessor<Node | undefined>;
    setRef: Setter<Node | undefined>;

    addItems(items: (Item | ItemWithChildren)[]): void;
    items: Accessor<(Item | ItemWithChildren)[]>;
    commands(): CommandType[];
};

export interface Item {
    kind: 'leaf';
    id: string;
    label: string;
    command: CommandType;
}

export interface ItemWithChildren {
    kind: 'node';
    id: string;
    label: string;
    children: Item[];
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
                .map(item => item.kind === 'node' ? item.children.map(c => c.command) : item.command)
                .flat()
                .concat(props.commands ?? []);
        },
    };

    return <MenuContext.Provider value={ctx}>{props.children}</MenuContext.Provider>;
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
            <Command command={props.command} />
        </button>
    };

    return <Portal mount={menu.ref()}>
        <For each={items}>{
            item => <Show when={Object.hasOwn(item, 'children') ? item as ItemWithChildren : undefined} fallback={<Child command={item.command} />}>{
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
                        <For each={item().children}>
                            {(child) => <Child command={child.command} />}
                        </For>
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
            }</Show>
        }</For>
    </Portal>
};

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            anchor?: string | undefined;
        }

        interface Directives {
            asMenuRoot: true;
        }
    }
}

export const asMenuRoot = (element: Element) => {
    const menu = useMenu();

    const c = 'menu-root';
    const listener = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        const modifiers =
            (e.shiftKey ? 1 : 0) << 0 |
            (e.ctrlKey ? 1 : 0) << 1 |
            (e.metaKey ? 1 : 0) << 2 |
            (e.altKey ? 1 : 0) << 3;

        const commands = menu.commands();
        const command = commands.find(c => c.shortcut?.key === key && (c.shortcut.modifier === undefined || c.shortcut.modifier === modifiers));

        if (command === undefined) {
            return;
        }

        command();

        e.preventDefault();
        return false;
    };

    onMount(() => {
        element.classList.add(c);
        document.addEventListener('keydown', listener);
    });

    onCleanup(() => {
        element.classList.remove(c);
        document.removeEventListener('keydown', listener);
    });

    menu.setRef(element);
};

export const Menu = { Root, Item } as const;

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

    // temp debug code 
    createEffect(() => {
        search()?.searchFor('c');
        setOpen(true);
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
    const [selected, setSelected] = createSignal<number>();
    const id = createUniqueId();

    const results = createMemo(() => {
        const search = term();

        if (search === '') {
            return [];
        }

        return props.items.filter(item => props.filter ? props.filter(item, search) : props.keySelector(item).includes(search));
    });

    const value = createMemo(() => {
        const index = selected();

        if (index === undefined) {
            return undefined;
        }

        return results().at(index);
    });
    const inputValue = createMemo(() => {
        const v = value();

        return v !== undefined ? props.keySelector(v) : term();
    });

    const ctx = {
        filter: term,
        results,
        value,
        searchFor(term: string) {
            setTerm(term);
        },
        clear() {
            setTerm('');
            setSelected(undefined);
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
            setSelected(current => current !== undefined && current > 0 ? current - 1 : undefined);

            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            setSelected(current => current !== undefined ? Math.min(results().length - 1, current + 1) : 0);

            e.preventDefault();
        }
    };

    const onSubmit = (e: SubmitEvent) => {
        e.preventDefault();

        if (selected() === undefined && term() !== '') {
            setSelected(0);
        }

        const v = value();

        if (v === undefined) {
            return;
        }

        ctx.clear();
        props.onSubmit?.(v);
    };

    return <form method="dialog" class={css.search} onkeydown={onKeyDown} onsubmit={onSubmit}>
        <input id={`search-${id}`} ref={setInput} value={inputValue()} oninput={(e) => setTerm(e.target.value)} placeholder="start typing for command" autofocus />

        <output for={`search-${id}`}>
            <For each={results()}>{
                (result, index) => <div classList={{ [css.selected]: index() === selected() }}>{props.children(result, ctx)}</div>
            }</For>
        </output>
    </form>;
};
