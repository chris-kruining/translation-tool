import { Component, JSX, ParentComponent, children, createContext, createRenderEffect, createUniqueId, mergeProps, onCleanup, useContext } from "solid-js";
import { isServer, ssr, useAssets } from "solid-js/web";

export interface MenuContextType {
    add(item: Item): number;
    remove(index: number): void;
};

export interface Item {
    ref?: Element;
    id: string;
    label: string;
    children?: Omit<Item, 'children'>[];
}

const MenuContext = createContext<MenuContextType>();

const initClientProvider = () => {
    console.log(document.querySelector('[data-app-menu="root"]'));
    console.log(document.querySelector('[data-app-menu="ssr-items"]'));

    return {
        add(item: Item) {
            return -1;
        },
        remove(index: number) {},
    };
};

const initServerProvider = () => {
    const items: Item[] = [];

    useAssets(() => ssr(`<div data-app-menu="ssr-items">${JSON.stringify(items)}</div>`) as any);

    return {
        add(item: Item) {
            return items.push(item);
        },
        remove(index: number) {},
    };
};

export const MenuProvider: ParentComponent = (props) => {
    const ctx = isServer ? initServerProvider() : initClientProvider();

    return <MenuContext.Provider value={ctx}>{props.children}</MenuContext.Provider>;
}

const useMenu = () => { 
    const context = useContext(MenuContext);

    if(context === undefined) {
        throw new Error('<Menu /> is called outside of a <MenuProvider />');
    }

    return context;
}

export const MenuItem: ParentComponent<{ label: string }> = (props) => {
    const childItems = children(() => props.children);

    return mergeProps(props, {
        get children() {
            return childItems();
        }
    }) as unknown as JSX.Element;
}

export const Menu: ParentComponent<{}> = (props) => {
    const menu = useMenu();
    const items: { label: string, children?: { label: string }[] }[] = (isServer 
        ? props.children
        : props.children?.map(c => c())) ?? [];

    createRenderEffect(() => {
        const indices = items.map(({ label, children }) => 
            menu.add({ 
                id: createUniqueId(),
                label, 
                children: children?.map(({ label }) => ({ id: createUniqueId(), label }))
            })
        );

        onCleanup(() => {
            for(const index of indices){
                menu.remove(index);
            }
        });
    });

    return null;
};

export const MenuRoot: Component = () => {
    const menu = useMenu();

    return <div data-app-menu="root"></div>

    // return <For each={menu?.items()}>
    //     {(item) => <>
    //         <button {...(item.children ? { popovertarget: item.label } : {})}>{item.label}</button>

    //         <Show when={item.children}>
    //             <div id={item.label} popover>
    //                 <For each={item.children}>
    //                     {(child) => <span>{child.label}</span>}
    //                 </For>
    //             </div>
    //         </Show>
    //     </>
    //     }
    // </For>;
};