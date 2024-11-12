import { Accessor, children, createContext, createEffect, createMemo, createSignal, For, JSX, onCleanup, ParentComponent, Setter, Show, useContext } from "solid-js";
import { Command, CommandType, noop, useCommands } from "~/features/command";
import { AiOutlineClose } from "solid-icons/ai";
import css from "./tabs.module.css";

interface TabsContextType {
    activate(id: string | undefined): void;
    isActive(id: string): Accessor<boolean>;
    readonly onClose: Accessor<CommandType<[string]> | undefined>
}

const TabsContext = createContext<TabsContextType>();

const useTabs = () => {
    const context = useContext(TabsContext);

    if (context === undefined) {
        throw new Error('<Tab /> is used outside of a <Tabs />')
    }

    return context!;
}

export const Tabs: ParentComponent<{ active?: Setter<string | undefined>, onClose?: CommandType<[string]> }> = (props) => {
    const [active, setActive] = createSignal<string | undefined>(undefined);

    createEffect(() => {
        props.active?.(active());
    });

    const ctx = {
        activate(id: string) {
            setActive(id);
        },

        isActive(id: string) {
            return createMemo(() => active() === id);
        },

        onClose: createMemo(() => props.onClose),
    };

    return <TabsContext.Provider value={ctx}>
        <_Tabs active={active()} onClose={props.onClose}>{props.children}</_Tabs>
    </TabsContext.Provider >;
}

const _Tabs: ParentComponent<{ active: string | undefined, onClose?: CommandType<[string]> }> = (props) => {
    const commandsContext = useCommands();
    const tabsContext = useTabs();

    const resolved = children(() => props.children);
    const tabs = createMemo(() => resolved.toArray().filter(c => c instanceof HTMLElement).map(({ id, dataset }, i) => ({ id, label: dataset.tabLabel, options: { closable: dataset.tabClosable } })));

    createEffect(() => {
        tabsContext.activate(tabs().at(-1)?.id);
    });

    const onClose = (e: Event) => {
        if (!commandsContext || !props.onClose) {
            return;
        }

        return commandsContext.execute(props.onClose, e);
    };

    return <div class={css.tabs}>
        <header>
            <For each={tabs()}>{
                ({ id, label, options: { closable = false } }) => <Command.Context for={props.onClose} with={[id]}>
                    <span class={css.handle} classList={{ [css.active]: props.active === id }}>
                        <button onpointerdown={() => tabsContext.activate(id)}>{label}</button>
                        <Show when={closable}>
                            <button onPointerDown={onClose}> <AiOutlineClose /></button>
                        </Show>
                    </span>
                </Command.Context>
            }</For>
        </header>

        {resolved()}
    </div>;
};

export const Tab: ParentComponent<{ id: string, label: string, closable?: boolean }> = (props) => {
    const context = useTabs();
    const resolved = children(() => props.children);
    const isActive = context.isActive(props.id);
    const [ref, setRef] = createSignal();

    // const isActive = context.register(props.id, props.label, {
    //     closable: props.closable ?? false,
    //     ref: ref,
    // });

    return <div
        ref={setRef()}
        id={props.id}
        data-tab-label={props.label}
        data-tab-closable={props.closable}
        style="dispay: contents;"
    >
        <Show when={isActive()}>
            <Command.Context for={context.onClose() ?? noop} with={[props.id]}>{resolved()}</Command.Context>
        </Show>
    </div>;
}