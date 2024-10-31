import { Link, Title } from "@solidjs/meta";
import { createEffect, createMemo, createSignal, ParentProps, Show } from "solid-js";
import { BsTranslate } from "solid-icons/bs";
import { FilesProvider } from "~/features/file";
import { CommandPalette, CommandPaletteApi, Menu, MenuProvider } from "~/features/menu";
import { isServer } from "solid-js/web";
import { A, createAsync } from "@solidjs/router";
import { createCommand, Modifier } from "~/features/command";
import { ColorScheme, ColorSchemePicker, getColorScheme } from "~/components/colorschemepicker";
import css from "./editor.module.css";

export default function Editor(props: ParentProps) {
    const storedColorScheme = createAsync<keyof typeof ColorScheme>(() => getColorScheme(), { initialValue: 'Auto' });

    const [commandPalette, setCommandPalette] = createSignal<CommandPaletteApi>();
    const colorScheme = createMemo(() => ColorScheme[storedColorScheme()]);
    const color = createMemo(() => ({
        [ColorScheme.Auto]: undefined,
        [ColorScheme.Light]: '#eee',
        [ColorScheme.Dark]: '#333',
    }[ColorScheme[storedColorScheme()]]));

    const supported = isServer || typeof window.showDirectoryPicker === 'function';
    const commands = [
        createCommand('open command palette', () => {
            commandPalette()?.show();
        }, { key: 'p', modifier: Modifier.Control | Modifier.Shift }),
    ];

    return <MenuProvider commands={commands}>
        <Title>Calque</Title>

        <meta id="theme-scheme" name="color-scheme" content={colorScheme()} />
        <meta id="theme-color" name="theme-color" content={color()} />

        <Show when={color() === undefined}>
            <meta id="theme-auto-light" name="theme-color" media="(prefers-color-scheme: light)" content="#eee" />
            <meta id="theme-auto-dark" name="theme-color" media="(prefers-color-scheme: dark)" content="#333" />
        </Show>

        <Link rel="icon" href="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
        <Link rel="icon" href="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
        <Link rel="manifest" href="/manifest.json" />

        <main class={css.layout} inert={commandPalette()?.open()}>
            <nav class={css.menu}>
                <A class={css.logo} href="/"><BsTranslate /></A>

                <Menu.Mount />

                <section class={css.right}>
                    <ColorSchemePicker />
                </section>
            </nav>

            <Show when={supported} fallback={<span>too bad, so sad. Your browser does not support the File Access API</span>}>
                <FilesProvider>
                    {props.children}
                </FilesProvider>
            </Show>
        </main>

        <CommandPalette api={setCommandPalette} />
    </MenuProvider>
}
