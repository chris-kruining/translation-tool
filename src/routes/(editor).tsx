import { Title } from "@solidjs/meta";
import { FilesProvider } from "~/features/file";
import { MenuProvider, asMenuRoot } from "~/features/menu";

asMenuRoot // prevents removal of import

export default function Editor(props) {
    return <MenuProvider>
        <Title>Translation-Tool</Title>

        <nav use:asMenuRoot />
        
        <main>
            <FilesProvider>
                {props.children}  
            </FilesProvider>
        </main>
    </MenuProvider>
}