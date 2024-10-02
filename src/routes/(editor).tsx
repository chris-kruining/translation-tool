import { Title } from "@solidjs/meta";
import { Show } from "solid-js";
import { BsTranslate } from "solid-icons/bs";
import { FilesProvider } from "~/features/file";
import { MenuProvider, asMenuRoot } from "~/features/menu";

asMenuRoot // prevents removal of import

export default function Editor(props) {
    const supported = typeof window.showDirectoryPicker === 'function';

    return <MenuProvider>
        <Title>Translation-Tool</Title>

        <nav use:asMenuRoot>
            <BsTranslate class="logo" />
        </nav>
        
        <main>
        <Show when={supported} fallback={<span>too bad, so sad. Your browser does not support the File Access API</span>}>
        <FilesProvider>
        {props.children}
        </FilesProvider>
            </Show>
        </main>
    </MenuProvider>
}
