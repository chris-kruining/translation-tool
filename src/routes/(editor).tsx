import { Link, Meta, Style, Title } from "@solidjs/meta";
import { Component, createEffect, createMemo, createSignal, ErrorBoundary, ParentProps, Show } from "solid-js";
import { FilesProvider } from "~/features/file";
import { CommandPalette, CommandPaletteApi, Menu, MenuProvider } from "~/features/menu";
import { A, RouteDefinition, useBeforeLeave } from "@solidjs/router";
import { createCommand, Modifier } from "~/features/command";
import { ColorScheme, ColorSchemePicker, getState, useTheme } from "~/components/colorschemepicker";
import css from "./editor.module.css";

export const route: RouteDefinition = {
    preload: () => getState(),
};

export default function Editor(props: ParentProps) {
    const theme = useTheme();

    const [commandPalette, setCommandPalette] = createSignal<CommandPaletteApi>();

    const color = createMemo(() => ({
        [ColorScheme.Auto]: undefined,
        [ColorScheme.Light]: '#eee',
        [ColorScheme.Dark]: '#333',
    }[theme.colorScheme]));

    const commands = [
        createCommand('open command palette', () => {
            commandPalette()?.show();
        }, { key: 'p', modifier: Modifier.Control | Modifier.Shift }),
    ];

    const transition = (done: () => void) => {
        if (!document.startViewTransition) { return done() }

        const transition = document.startViewTransition(done)
    }

    useBeforeLeave((e) => {
        e.preventDefault();

        transition(() => { e.retry(true) })
    });

    return <MenuProvider commands={commands}>
        <Title>Calque</Title>

        <Meta id="theme-scheme" name="color-scheme" content={theme.colorScheme} />
        <Show when={color() === undefined} fallback={<Meta id="theme-color" name="theme-color" content={color()} />}>
            <Meta id="theme-auto-light" name="theme-color" media="(prefers-color-scheme: light)" content="#eee" />
            <Meta id="theme-auto-dark" name="theme-color" media="(prefers-color-scheme: dark)" content="#333" />
        </Show>

        <Style>{`
            :root {
                --hue: ${theme.hue}deg !important;
            }
        `}</Style>

        <Link rel="icon" href="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
        <Link rel="icon" href="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
        <Link rel="manifest" href="/manifest.json" />

        <main class={css.layout} inert={commandPalette()?.open()}>
            <nav class={css.menu}>
                <A class={css.logo} href="/">
                    <picture>
                        <source srcset="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
                        <source srcset="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
                        <img src="/images/favicon.dark.svg" alt="Calque logo" />
                    </picture>
                </A>

                <Menu.Mount />

                <section class={css.right}>
                    <ColorSchemePicker />

                </section>
            </nav>

            <section>
                <ErrorBoundary fallback={err => <ErrorComp error={err} />}>
                    <FilesProvider>
                        {props.children}
                    </FilesProvider>
                </ErrorBoundary>
            </section>
        </main>

        <CommandPalette api={setCommandPalette} />
    </MenuProvider>
}

const ErrorComp: Component<{ error: Error }> = (props) => {
    return <div class={css.error}>
        <b>{props.error.message}</b>

        <Show when={props.error.cause}>{
            cause => <>{cause().description}</>
        }</Show>

        <a href="/">Return to start</a>
    </div>;
};
