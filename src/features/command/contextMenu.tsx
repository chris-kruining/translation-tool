import { Accessor, Component, createContext, createEffect, createMemo, createSignal, createUniqueId, For, JSX, ParentComponent, splitProps, useContext } from "solid-js";
import { CommandType } from "./index";
import css from "./contextMenu.module.css";

interface ContextMenuType {
    readonly commands: Accessor<CommandType[]>;
    readonly target: Accessor<HTMLElement | undefined>;
    show(element: HTMLElement): void;
    hide(): void;
}

const ContextMenu = createContext<ContextMenuType>()

const Root: ParentComponent<{ commands: CommandType[] }> = (props) => {
    const [target, setTarget] = createSignal<HTMLElement>();

    const context = {
        commands: createMemo(() => props.commands),
        target,
        show(element: HTMLElement) {
            setTarget(element);
        },
        hide() {
            setTarget(undefined);
        },
    };

    return <ContextMenu.Provider value={context}>
        {props.children}
    </ContextMenu.Provider>
};

const Menu: Component<{ children: (command: CommandType) => JSX.Element }> = (props) => {
    const context = useContext(ContextMenu)!;
    const [root, setRoot] = createSignal<HTMLElement>();

    createEffect(() => {
        const target = context.target();
        const menu = root();

        if (!menu) {
            return;
        }

        if (target) {
            menu.showPopover();
        }
        else {
            menu.hidePopover();
        }
    });

    const onToggle = (e: ToggleEvent) => {
        if (e.newState === 'closed') {
            context.hide();
        }
    };

    const onCommand = (command: CommandType) => (e: PointerEvent) => {
        context.hide();

        command();
    };

    return <ul ref={setRoot} class={css.menu} style={`position-anchor: ${context.target()?.style.getPropertyValue('anchor-name')};`} popover ontoggle={onToggle}>
        <For each={context.commands()}>{
            command => <li onpointerdown={onCommand(command)}>{props.children(command)}</li>
        }</For>
    </ul>;
};

const Handle: ParentComponent<Record<string, any>> = (props) => {
    const [local, rest] = splitProps(props, ['children']);

    const context = useContext(ContextMenu)!;
    const [handle, setHandle] = createSignal<HTMLElement>();

    return <span {...rest} ref={setHandle} style={`anchor-name: --context-menu-handle-${createUniqueId()};`} oncontextmenu={(e) => {
        e.preventDefault();

        context.show(handle()!);

        return false;
    }}>{local.children}</span>;
};

export const Context = { Root, Menu, Handle };