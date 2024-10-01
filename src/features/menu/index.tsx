import { Accessor, Component, For, JSX, ParentComponent, Setter, Show, children, createContext, createMemo, createSignal, createUniqueId, mergeProps, onCleanup, onMount, splitProps, useContext } from "solid-js";
import { Portal, isServer } from "solid-js/web";
import './style.css';
import { createStore } from "solid-js/store";

export interface MenuContextType {
    ref: Accessor<JSX.Element|undefined>;
    setRef: Setter<JSX.Element|undefined>;

    addItems(items: (Item|ItemWithChildren)[]): void;
    items: Accessor<(Item|ItemWithChildren)[]>;
    commands(): Command[];
};

export enum Modifier {
    Shift = 1 << 0,
    Control = 1 << 1,
    Meta = 1 << 2,
    Alt = 1 << 3,
}

export interface Command {
    (): any;
    shortcut?: {
        key: string;
        modifier?: Modifier;
    };
}

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

export const createCommand = (command: () => any, shortcut?: Command['shortcut']): Command => {
    if(shortcut) {
        (command as Command).shortcut = { key: shortcut.key.toLowerCase(), modifier: shortcut.modifier };
    }
    
    return command;
};

export const MenuProvider: ParentComponent = (props) => {
    const [ ref, setRef ] = createSignal<JSX.Element|undefined>();
    const [ _items, setItems ] = createSignal<Map<string, Item&{ children?: Map<string, Item> }>>(new Map());

    const [ store, setStore ] = createStore<{ items: Record<string, Item|ItemWithChildren> }>({ items: {} });

    const addItems = (items: (Item|ItemWithChildren)[]) => setStore('items', values => {
        for (const item of items) {
            // const existing = values.get(item.id);
            
            // if(item.children && existing?.children instanceof Map) {
            //     for (const child of item.children) {
            //         existing.children.set(child.id, child);
            //     }
            // }
            // else if (item.children && existing === undefined){
            //     values.set(item.id, { ...item, children: new Map(item.children.map(c => [ c.id, c ])) });
            // }
            // else {
            //     values.set(item.id, item as Item);
            // }
            values[item.id] = item;
        }

        return values;
    });
    const items = createMemo<(Item|ItemWithChildren)[]>(() => 
        Array.from(
            Object.values(store.items), 
            // item => item.children instanceof Map ? { ...item, children: Array.from(item.children.values()) } : item
        )
    );
    const commands = createMemo(() => items().map(item => item.children instanceof Array ? item.children.map(c => c.command) : item.command).flat());

    return <MenuContext.Provider value={{ ref, setRef, addItems, items, commands }}>{props.children}</MenuContext.Provider>;
}

const useMenu = () => { 
    const context = useContext(MenuContext);

    if(context === undefined) {
        throw new Error('<Menu /> is called outside of a <MenuProvider />');
    }

    return context;
}

type ItemProps = { label: string, children: JSX.Element }|{ label: string, command: Command };

const Item: Component<ItemProps> = (props) => {
    const id = createUniqueId();

    if(props.command) {
        return mergeProps(props, { id }) as unknown as JSX.Element;
    }

    const childItems = children(() => props.children);

    return mergeProps(props, {
        id,
        get children() {
            return childItems();
        }
    }) as unknown as JSX.Element;
}

const Root: ParentComponent<{}> = (props) => {
    const menu = useMenu();

    menu.addItems((isServer 
        ? props.children
        : props.children?.map(c => c())) ?? [])

    const Button: Component<{ label: string, command: Command }|{ [key: string]: any }> = (props) => {
        const [ local, rest ] = splitProps(props, ['label', 'command']);
        return <button class="item" on:pointerDown={local.command} {...rest}>{local.label}</button>;
    };

    return <Portal mount={menu.ref()}>
        <For each={menu.items()}>
            {(item) => <>
                <Button label={item.label} {...(item.children ? { popovertarget: `child-${item.id}`, id: `menu-${item.id}`, command: item.command } : {})} />

                <Show when={item.children}>
                    <div class="child" id={`child-${item.id}`} anchor={`menu-${item.id}`} style="inset: unset;" popover>
                        <For each={item.children}>
                            {(child) => <Button label={child.label} command={child.command} />}
                        </For>
                    </div>
                </Show>
            </>
            }
        </For>
    </Portal>
};

declare module "solid-js" {
    namespace JSX {
        interface HTMLAttributes<T> {
            anchor?: string|undefined;
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
            (e.altKey ? 1 : 0) << 3 ;

        const commands = menu.commands();
        const command = commands.find(c => c.shortcut?.key === key && (c.shortcut.modifier === undefined || c.shortcut.modifier === modifiers));

        if(command === undefined) {
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