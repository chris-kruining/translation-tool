import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from "solid-icons/tb";
import { createMemo, createSignal, ParentComponent, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import css from "./sidebar.module.css";

export const Sidebar: ParentComponent<{ as?: string, open?: boolean, name?: string, label?: string } & Record<string, any>> = (props) => {
    const [local, forwarded] = splitProps(props, ['as', 'open', 'name', 'class', 'label']);

    const [open, setOpen] = createSignal(local.open ?? true);
    const name = createMemo(() => local.name ?? 'sidebar');

    return <Dynamic component={local.as ?? 'div'} class={`${css.root} ${open() ? css.open : css.closed} ${local.class}`} {...forwarded}>
        <button
            role="button"
            onclick={() => setOpen(o => !o)}
            title={`${open() ? 'close' : 'open'} ${name()}`}
        >
            <Show when={open()} fallback={<TbLayoutSidebarLeftExpand />}>
                <TbLayoutSidebarLeftCollapse /> {local.label}
            </Show>
        </button>

        <div class={css.content}>
            {props.children}
        </div>
    </Dynamic>
};