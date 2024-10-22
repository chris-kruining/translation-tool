import { Title } from "@solidjs/meta";
import { Component, createEffect, createMemo, createSignal, For, ParentProps, Show } from "solid-js";
import { BsTranslate } from "solid-icons/bs";
import { FilesProvider } from "~/features/file";
import { CommandPalette, CommandPaletteApi, MenuProvider, asMenuRoot, useMenu } from "~/features/menu";
import { isServer } from "solid-js/web";
import { A } from "@solidjs/router";
import { createCommand, Modifier } from "~/features/command";

asMenuRoot // prevents removal of import

export default function Editor(props: ParentProps) {
    const [commandPalette, setCommandPalette] = createSignal<CommandPaletteApi>();

    const supported = isServer || typeof window.showDirectoryPicker === 'function';
    const commands = [
        createCommand('open command palette', () => {
            commandPalette()?.show();
        }, { key: 'p', modifier: Modifier.Control | Modifier.Shift }),
    ];

    return <MenuProvider commands={commands}>
        <Title>Translation-Tool</Title>

        <main inert={commandPalette()?.open()}>
            <nav use:asMenuRoot>
                <A class="logo" href="/"><BsTranslate /></A>
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
