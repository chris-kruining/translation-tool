import { Title } from "@solidjs/meta";
import { Show } from "solid-js";
import { BsTranslate } from "solid-icons/bs";
import { FilesProvider } from "~/features/file";
import { MenuProvider, asMenuRoot } from "~/features/menu";
import { isServer } from "solid-js/web";
import { A } from "@solidjs/router";

asMenuRoot // prevents removal of import

export default function Editor(props) {
    const supported = isServer || typeof window.showDirectoryPicker === 'function';

    return <MenuProvider>
        <Title>Translation-Tool</Title>

        <nav use:asMenuRoot>
            <A class="logo" href="/"><BsTranslate /></A>
        </nav>

        <main style="padding: 1em; block-size: 100%; overflow: clip;">
            <Show when={supported} fallback={<span>too bad, so sad. Your browser does not support the File Access API</span>}>
                <FilesProvider>
                    {props.children}
                </FilesProvider>
            </Show>
        </main>
    </MenuProvider>
}
