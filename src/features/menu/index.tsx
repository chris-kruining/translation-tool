import { Accessor, Component, For, JSX, ParentComponent, Setter, Show, children, createContext, createRenderEffect, createSignal, createUniqueId, mergeProps, onCleanup, useContext } from "solid-js";
import { Portal, isServer, ssr, useAssets } from "solid-js/web";

export interface MenuContextType {
    ref(): JSX.Element|undefined;
    // setRef(ref: JSX.Element|undefined): void;
};

export interface Item {
    ref?: Element;
    id: string;
    label: string;
    children?: Omit<Item, 'children'>[];
}

const MenuContext = createContext<MenuContextType>();

// const initClientProvider = (): MenuContextType => {
//     const root = document.querySelector('[data-app-menu="root"]');
//     const items = JSON.parse(document.querySelector('[data-app-menu="ssr-items"]')?.textContent ?? '[]');

//     console.log(items);

//     let _ref!: JSX.Element;

//     // useAssets(() => ssr(`<script type="application/json" data-app-menu="ssr-items">${JSON.stringify(items)}</script>`) as any);

//     return {
//         ref() {
//             return _ref;
//         },
//         setRef(ref: JSX.Element) {
//             _ref = ref;
//         },
//     };
// };

// const initServerProvider = (): MenuContextType => {
//     let _ref!: JSX.Element;

//     // useAssets(() => ssr(`<script type="application/json" data-app-menu="ssr-items">${JSON.stringify(items)}</script>`) as any);

//     return {
//         ref() {
//             return _ref;
//         },
//         setRef(ref: JSX.Element) {
//             _ref = ref;
//         },
//     };
// };

export const MenuProvider: ParentComponent<{ root?: JSX.Element }> = (props) => {
    // const ctx = isServer ? initServerProvider() : initClientProvider();

    // const [ ref, setRef ] = createSignal<JSX.Element>();
    // const ctx = {ref, setRef};

    return <MenuContext.Provider value={{ ref: () => props.root }}>{props.children}</MenuContext.Provider>;
}

const useMenu = () => { 
    const context = useContext(MenuContext);

    if(context === undefined) {
        throw new Error('<Menu /> is called outside of a <MenuProvider />');
    }

    return context;
}

const Item: ParentComponent<{ label: string }> = (props) => {
    const childItems = children(() => props.children);

    return mergeProps(props, {
        get children() {
            return childItems();
        }
    }) as unknown as JSX.Element;
}

const Root: ParentComponent<{}> = (props) => {
    const menu = useMenu();
    const items: { label: string, children?: { label: string }[] }[] = (isServer 
        ? props.children
        : props.children?.map(c => c())) ?? [];

    return <Portal mount={menu.ref()}>
        <For each={items}>
            {(item) => <>
                <button {...(item.children ? { popovertarget: item.label } : {})}>{item.label}</button>

                <Show when={item.children}>
                    <div id={item.label} popover>
                        <For each={item.children}>
                            {(child) => <span>{child.label}</span>}
                        </For>
                    </div>
                </Show>
            </>
            }
        </For>
    </Portal>
};

export const Menu = { Root, Item } as const;