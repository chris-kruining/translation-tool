import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from "solid-icons/tb";
import { createMemo, createSignal, onMount, ParentComponent, Show } from "solid-js";
import { Dynamic, Portal, render } from "solid-js/web";
import css from "./sidebar.module.css";

export const Sidebar: ParentComponent<{ as?: string, open?: boolean, name?: string }> = (props) => {
    const [open, setOpen] = createSignal(props.open ?? true)
    const cssClass = createMemo(() => open() ? css.open : css.closed);
    const name = createMemo(() => props.name ?? 'sidebar');

    const toggle = () => setOpen(o => !o);

    let ref: Element;
    return <Dynamic component={props.as ?? 'div'} class={`${css.root} ${cssClass()}`} ref={ref}>
        <Portal mount={ref!} useShadow={true}>
            <button onclick={() => toggle()} role="button" title={`${open() ? 'close' : 'open'} ${name()}`}>
                <Show when={open()} fallback={<TbLayoutSidebarLeftExpand />}>
                    <TbLayoutSidebarLeftCollapse />
                </Show>
            </button>

            <div class={css.content}>
                <slot />
            </div>
        </Portal>

        {props.children}
    </Dynamic>
};