import { Accessor, children, createContext, createMemo, createSignal, createUniqueId, For, JSX, ParentComponent, useContext } from "solid-js";
import css from "./tabs.module.css";

interface TabsContextType {
    activate(id: string): void;
    active: Accessor<string | undefined>;
    isActive(id: string): Accessor<boolean>;
}

const TabsContext = createContext<TabsContextType>();

export const Tabs: ParentComponent = (props) => {
    const [active, setActive] = createSignal<string | undefined>(undefined);
    const numberOfTabs = createMemo(() => children(() => props.children).toArray().length);

    return <TabsContext.Provider value={{
        activate(id: string) {
            setActive(id);
        },

        active,

        isActive(id: string) {
            return createMemo(() => active() === id);
        },
    }}>
        <div class={css.root} style={{ '--tab-count': numberOfTabs() }}>
            {props.children}
        </div>
    </TabsContext.Provider>;
}

export const Tab: ParentComponent<{ label: string }> = (props) => {
    const id = `tab-${createUniqueId()}`;
    const context = useContext(TabsContext);

    if (!context) {
        return undefined;
    }

    return <details class={css.tab} id={id} open={context.active() === id} ontoggle={(e: ToggleEvent) => e.newState === 'open' && context.activate(id)}>
        <summary>{props.label}</summary>

        {props.children}
    </details>
}