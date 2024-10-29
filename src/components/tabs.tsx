import { Accessor, children, createContext, createEffect, createMemo, createSignal, For, onCleanup, ParentComponent, Setter, Show, useContext } from "solid-js";
import { IoCloseCircleOutline } from "solid-icons/io";
import css from "./tabs.module.css";
import { Command, CommandType, commandArguments, noop, useCommands } from "~/features/command";

commandArguments;

interface TabsContextType {
    register(id: string, label: string, options?: Partial<TabOptions>): Accessor<boolean>;
    readonly onClose: Accessor<CommandType<[string]> | undefined>
}

interface TabOptions {
    closable: boolean;
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
    const commandsContext = useCommands();
    const [active, setActive] = createSignal<string | undefined>(undefined);
    const [tabs, setTabs] = createSignal<Map<string, { label: string, options: Partial<TabOptions> }>>(new Map());

    createEffect(() => {
        props.active?.(active());
    });

    createEffect(() => {
        setActive(tabs().keys().toArray().at(-1));
    });

    const ctx = {
        register(id: string, label: string, options: Partial<TabOptions>) {
            setTabs(tabs => {
                tabs.set(id, { label, options });

                return new Map(tabs);
            });

            return createMemo(() => active() === id);
        },
        onClose: createMemo(() => props.onClose),
    };

    const onClose = (e: Event) => {
        if (!commandsContext || !props.onClose) {
            return;
        }

        return commandsContext.execute(props.onClose, e);
    };

    return <TabsContext.Provider value={ctx}>
        <div class={css.tabs}>
            <header>
                <For each={tabs().entries().toArray()}>{
                    ([id, { label, options: { closable = false } }]) => <Command.Context for={props.onClose} with={[id]}>
                        <span class={css.handle} classList={{ [css.active]: active() === id }}>
                            <button onpointerdown={() => setActive(id)}>{label}</button>
                            <Show when={closable}>
                                <button onPointerDown={onClose}> <IoCloseCircleOutline /></button>
                            </Show>
                        </span>
                    </Command.Context>
                }</For>
            </header>

            {props.children}
        </div>
    </TabsContext.Provider >;
}

export const Tab: ParentComponent<{ id: string, label: string, closable?: boolean }> = (props) => {
    const context = useTabs();

    const isActive = context.register(props.id, props.label, {
        closable: props.closable ?? false
    });
    const resolved = children(() => props.children);

    return <Show when={isActive()}><Command.Context for={context.onClose()} with={[props.id]}>{resolved()}</Command.Context></Show>;
}