import { Accessor, children, createContext, createEffect, createMemo, createRenderEffect, createSignal, createUniqueId, For, JSX, onMount, ParentComponent, Show, useContext } from "solid-js";
import css from "./tabs.module.css";

interface TabsContextType {
    register(id: string, label: string): Accessor<boolean>;
}

const TabsContext = createContext<TabsContextType>();

const useTabs = () => {
    const context = useContext(TabsContext);

    if (context === undefined) {
        throw new Error('<Tab /> is used outside of a <Tabs />')
    }

    return context!;
}

export const Tabs: ParentComponent = (props) => {
    const [active, setActive] = createSignal<string | undefined>(undefined);
    const [tabs, setTabs] = createSignal<{ id: string, label: string }[]>([]);
    // const resolved = children(() => props.children);
    // const resolvedArray = createMemo(() => resolved.toArray());
    // const tabs = createMemo(() => resolvedArray().map(t => ({ id: t.id, label: t.dataset?.label ?? '' })));

    // createEffect(() => {
    //     for (const t of resolvedArray()) {
    //         console.log(t);
    //     }
    // });

    createEffect(() => {
        setActive(tabs().at(-1)?.id);
    });

    // createRenderEffect(() => {
    //     if (isServer) {
    //         return;
    //     }

    //     for (const t of resolvedArray().filter(t => t instanceof HTMLElement)) {
    //         if (active() === t.id) {
    //             t.classList.add(css.active);
    //         } else {
    //             t.classList.remove(css.active);
    //         }
    //     }
    // });

    const ctx = {
        register(id: string, label: string) {
            setTabs(tabs => [...tabs, { id, label }]);

            return createMemo(() => active() === id);
        },
    };

    createEffect(() => {
        console.log(tabs());
    });

    return <TabsContext.Provider value={ctx}>
        <div class={css.tabs}>
            <header>
                <For each={tabs()}>{
                    tab => <button onpointerdown={() => setActive(tab.id)} classList={{ [css.active]: active() === tab.id }}>{tab.label}</button>
                }</For>
            </header>

            {props.children}
        </div>
    </TabsContext.Provider>;
}

export const Tab: ParentComponent<{ id: string, label: string }> = (props) => {
    const context = useTabs();

    const isActive = context.register(props.id, props.label);
    const resolved = children(() => props.children);

    return <Show when={isActive()}>{resolved()}</Show>;
}