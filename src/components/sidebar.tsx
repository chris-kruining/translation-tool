import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from "solid-icons/tb";
import { createMemo, createSignal, ParentComponent, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import css from "./sidebar.module.css";

export const Sidebar: ParentComponent<{ as?: string, open?: boolean, name?: string }> = (props) => {
    const [open, setOpen] = createSignal(props.open ?? true);
    const name = createMemo(() => props.name ?? 'sidebar');

    return <Dynamic component={props.as ?? 'div'} class={`${css.root} ${open() ? css.open : css.closed}`}>
        <button
            role="button"
            onclick={() => setOpen(o => !o)}
            title={`${open() ? 'close' : 'open'} ${name()}`}
        >
            <Show when={open()} fallback={<TbLayoutSidebarLeftExpand />}>
                <TbLayoutSidebarLeftCollapse />
            </Show>
        </button>

        <div class={css.content}>
            {props.children}
        </div>
    </Dynamic>
};