import { createEffect, createSignal, createUniqueId, JSX, onMount, ParentComponent, Show } from "solid-js";
import css from './prompt.module.css';

export interface PromptApi {
    showModal(): Promise<FormData | undefined>;
};

class PromptCanceledError extends Error { }

export const Prompt: ParentComponent<{ api: (api: PromptApi) => any, title?: string, description?: string | JSX.Element }> = (props) => {
    const [dialog, setDialog] = createSignal<HTMLDialogElement>();
    const [form, setForm] = createSignal<HTMLFormElement>();
    const [resolvers, setResolvers] = createSignal<[(...args: any[]) => any, (...args: any[]) => any]>();
    const submitId = createUniqueId();
    const cancelId = createUniqueId();

    const api = {
        async showModal(): Promise<FormData | undefined> {
            const { promise, resolve, reject } = Promise.withResolvers();

            setResolvers([resolve, reject]);

            dialog()!.showModal();

            try {
                await promise;

                return new FormData(form());
            }
            catch (e) {
                if (!(e instanceof PromptCanceledError)) {
                    throw e;
                }

                dialog()!.close();
                setResolvers(undefined);
            }
        },
    };

    const onSubmit = (e: SubmitEvent) => {
        resolvers()?.[0]();
    };

    const onCancel = (e: Event) => {
        resolvers()?.[1](new PromptCanceledError());
    };

    createEffect(() => {
        props.api(api);
    });

    return <dialog class={css.prompt} ref={setDialog} onsubmit={onSubmit} onCancel={onCancel} onReset={onCancel}>
        <form method="dialog" ref={setForm}>
            <Show when={props.title || props.description}>
                <header>
                    <Show when={props.title}>{
                        title => <b class={css.title}>{title()}</b>
                    }</Show>

                    <Show when={props.description}>{
                        description => <p>{description()}</p>
                    }</Show>
                </header>
            </Show>

            <main>{props.children}</main>

            <footer>
                <button id={submitId} type="submit">Ok</button>
                <button id={cancelId} type="reset">Cancel</button>
            </footer>
        </form>
    </dialog>;
};