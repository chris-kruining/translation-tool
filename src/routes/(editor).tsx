import { Title } from "@solidjs/meta";
import { FilesProvider } from "~/features/file";
import { MenuRoot, MenuProvider } from "~/features/menu";


export default function Editor(props) {
    return <MenuProvider>
        <nav>
            <Title>Translation-Tool</Title>
            <a href="/">Index</a>
            <a href="/about">About</a>
            <MenuRoot />
        </nav>

        <main>
            <FilesProvider>
                {props.children}  
            </FilesProvider>
        </main>
    </MenuProvider>
}