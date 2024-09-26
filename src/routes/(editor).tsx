import { Title } from "@solidjs/meta";
import { JSX, createSignal } from "solid-js";
import { FilesProvider } from "~/features/file";
import { MenuProvider, Menu } from "~/features/menu";


export default function Editor(props) {
    const [ref, setRef] = createSignal<JSX.Element>();

    return <MenuProvider root={ref()}>
        <Title>Translation-Tool</Title>

        <nav ref={setRef}>
            <a href="/">Index</a>
            <a href="/about">About</a>
        </nav>
        
        <main>
            <FilesProvider>
                {props.children}  
            </FilesProvider>
        </main>
    </MenuProvider>
}