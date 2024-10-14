import { Accessor, children, Component, createContext, createEffect, createMemo, createSignal, createUniqueId, For, JSX, ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import css from "./tabs.module.css";
import { Portal } from "solid-js/web";

interface TabsContextType {
    isActive(): boolean;
}

interface TabsState {
    tabs: TabType[];
}

interface TabType {
    id: string;
    label: string;
}

const TabsContext = createContext<TabsContextType>();

export const Tabs: Component<{ children?: JSX.Element }> = (props) => {
    const [state, setState] = createStore<TabsState>({ tabs: [] });

    createEffect(() => {
        const tabs = children(() => props.children).toArray();

        console.log(tabs);

        setState('tabs', tabs.map(t => ({ id: t.id, label: t.getAttribute('data-label') })))
    });

    const ctx: TabsContextType = {
        isActive() {
            return false;
        }
    };

    return <TabsContext.Provider value={ctx}>
        <header>
            <For each={state.tabs}>{
                tab => <button type="button" onpointerdown={() => activate(tab.id)}>{tab.label}</button>
            }</For>
        </header>

        {props.children}
    </TabsContext.Provider>
};

export const Tab: ParentComponent<{ label: string }> = (props) => {
    const context = useContext(TabsContext);

    return <div id={createUniqueId()} data-label={props.label}>{props.children}</div>
}

interface TabsSimpleContextType {
    activate(id: string): void;
    active: Accessor<string | undefined>;
    isActive(id: string): Accessor<boolean>;
}

const TabsSimpleContext = createContext<TabsSimpleContextType>();

export const TabsSimple: ParentComponent = (props) => {
    const [active, setActive] = createSignal<string | undefined>(undefined);

    return <TabsSimpleContext.Provider value={{
        activate(id: string) {
            setActive(id);
            // setState('active', id);
        },

        active,

        isActive(id: string) {
            return createMemo(() => active() === id);
        },
    }}>
        <div class={css.root}>
            {props.children}
        </div>
    </TabsSimpleContext.Provider>;
}

export const TabSimple: ParentComponent<{ label: string }> = (props) => {
    const id = `tab-${createUniqueId()}`;
    const context = useContext(TabsSimpleContext);

    if (!context) {
        return undefined;
    }

    return <details class={css.tab} id={id} open={context.active() === id} ontoggle={(e: ToggleEvent) => e.newState === 'open' && context.activate(id)}>
        <summary>{props.label}</summary>

        {props.children}
    </details>
}