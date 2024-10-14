import { Accessor, Component, For, JSX, ParentComponent, Setter, Show, children, createContext, createEffect, createMemo, createSignal, createUniqueId, mergeProps, onCleanup, onMount, splitProps, useContext } from "solid-js";
import { Portal, isServer } from "solid-js/web";
import { createStore } from "solid-js/store";
import { Command, Modifier } from "../command";

export interface MenuContextType {
    ref: Accessor<JSX.Element | undefined>;
    setRef: Setter<JSX.Element | undefined>;

    addItems(items: (Item | ItemWithChildren)[]): void;
    items: Accessor<(Item | ItemWithChildren)[]>;
    commands(): Command[];
};

export interface Item {
    id: string;
    label: string;
    command: Command;
}

export interface ItemWithChildren {
    id: string;
    label: string;
    children: Item[];
}

const MenuContext = createContext<MenuContextType>();

export const MenuProvider: ParentComponent = (props) => {
    const [ref, setRef] = createSignal<JSX.Element | undefined>();
    const [_items, setItems] = createSignal<Map<string, Item & { children?: Map<string, Item> }>>(new Map());

    const [store, setStore] = createStore<{ items: Record<string, Item | ItemWithChildren> }>({ items: {} });

    const addItems = (items: (Item | ItemWithChildren)[]) => setStore('items', values => {
        for (const item of items) {
            values[item.id] = item;
        }

        return values;
    });
    const items = () => Object.values(store.items);
    const commands = () => Object.values(store.items).map(item => item.children?.map(c => c.command) ?? item.command).flat();

    return <MenuContext.Provider value={{ ref, setRef, addItems, items, commands }}>{props.children}</MenuContext.Provider>;
}

const useMenu = () => {
    const context = useContext(MenuContext);

    if (context === undefined) {
        throw new Error(`MenuContext is called outside of a <MenuProvider />`);
    }

    return context;
}

type ItemProps = { label: string, children: JSX.Element } | { label: string, command: Command };

const Item: Component<ItemProps> = (props) => {
    const id = createUniqueId();

    if (props.command) {
        return mergeProps(props, { id }) as unknown as JSX.Element;
    }

    const childItems = children(() => props.children);

    return mergeProps(props, {
        id,
        get children() {
            return childItems.toArray();
        }
    }) as unknown as JSX.Element;
}

const Root: ParentComponent<{}> = (props) => {
    const menu = useMenu();
    const [current, setCurrent] = createSignal<HTMLElement>();
    const items = children(() => props.children).toArray() as unknown as (Item & ItemWithChildren)[];

    menu.addItems(items)

    const close = () => {
        const el = current();

        if (el) {
            el.hidePopover();

            setCurrent(undefined);
        }
    };

    const onExecute = (command?: Command) => {
        return command
            ? async () => {
                await command?.();

                close();
            }
            : () => { }
    };

    const Button: Component<{ label: string, command?: Command } & { [key: string]: any }> = (props) => {
        const [local, rest] = splitProps(props, ['label', 'command']);
        return <button class="menu-item" type="button" on:pointerdown={onExecute(local.command)} {...rest}>
            {local.label}
            <Show when={local.command?.shortcut}>{
                shortcut => {
                    const shift = shortcut().modifier & Modifier.Shift ? 'Shft+' : '';
                    const ctrl = shortcut().modifier & Modifier.Control ? 'Ctrl+' : '';
                    const meta = shortcut().modifier & Modifier.Meta ? 'Meta+' : '';
                    const alt = shortcut().modifier & Modifier.Alt ? 'Alt+' : '';

                    return <sub>{ctrl}{shift}{meta}{alt}{shortcut().key}</sub>;
                }
            }</Show>
        </button>;
    };

    return <Portal mount={menu.ref()}>
        <For each={items}>{
            item => <>
                <Show when={item.children}>{
                    children => <div
                        class="menu-child"
                        id={`child-${item.id}`}
                        style={`position-anchor: --menu-${item.id};`}
                        popover
                        on:toggle={(e: ToggleEvent) => {
                            if (e.newState === 'open' && e.target !== null) {
                                return setCurrent(e.target as HTMLElement);
                            }
                        }}
                    >
                        <For each={children()}>
                            {(child) => <Button label={child.label} command={child.command} />}
                        </For>
                    </div>
                }</Show>

                <Button
                    label={item.label}
                    {...(item.children ? { popovertarget: `child-${item.id}`, style: `anchor-name: --menu-${item.id};` } : { command: item.command })}
                />
            </>
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