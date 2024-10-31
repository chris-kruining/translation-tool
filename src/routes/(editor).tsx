import { Link, Meta, Title } from "@solidjs/meta";
import { createSignal, For, ParentProps, Show } from "solid-js";
import { BsTranslate } from "solid-icons/bs";
import { FilesProvider } from "~/features/file";
import { CommandPalette, CommandPaletteApi, Menu, MenuProvider } from "~/features/menu";
import { isServer } from "solid-js/web";
import { A } from "@solidjs/router";
import { createCommand, Modifier } from "~/features/command";
import { ColorScheme, ColorSchemePicker } from "~/components/colorschemepicker";
import css from "./editor.module.css";

export default function Editor(props: ParentProps) {
    const [commandPalette, setCommandPalette] = createSignal<CommandPaletteApi>();
    const [colorScheme, setColorScheme] = createSignal<ColorScheme>(ColorScheme.Auto);

    const supported = isServer || typeof window.showDirectoryPicker === 'function';
    const commands = [
        createCommand('open command palette', () => {
            commandPalette()?.show();
        }, { key: 'p', modifier: Modifier.Control | Modifier.Shift }),
    ];

    return <MenuProvider commands={commands}>
        <Title>Calque</Title>
        <Meta name="color-scheme" content={colorScheme()} />
        <Link rel="icon" href="/images/favicon.dark.svg" media="screen and (prefers-color-scheme: dark)" />
        <Link rel="icon" href="/images/favicon.light.svg" media="screen and (prefers-color-scheme: light)" />
        <Link rel="manifest" href="/manifest.json" />

        <main class={css.layout} inert={commandPalette()?.open()}>
            <nav class={css.menu}>
                <A class={css.logo} href="/"><BsTranslate /></A>

                <Menu.Mount />

                <section class={css.right}>
                    <ColorSchemePicker value={[colorScheme, setColorScheme]} />
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
