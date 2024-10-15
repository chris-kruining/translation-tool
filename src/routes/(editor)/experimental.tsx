import { Component, createEffect, createMemo, createResource, createSignal, For, lazy, onMount, Suspense } from "solid-js";
import { useFiles } from "~/features/file";
import { Menu } from "~/features/menu";
import { createCommand, Modifier } from "~/features/command";
import { emptyFolder, FolderEntry, Tree, walk } from "~/components/filetree";
import { createStore, produce } from "solid-js/store";
import { Tab, Tabs } from "~/components/tabs";
import "./experimental.css";
import { selectable, SelectionProvider } from "~/features/selectable";

interface ExperimentalState {
  files: File[];
  numberOfFiles: number;
}

export default function Experimental() {
  const files = useFiles();
  const [tree, setTree] = createSignal<FolderEntry>(emptyFolder);
  const [state, setState] = createStore<ExperimentalState>({
    files: [],
    numberOfFiles: 0,
  });
  const [showHiddenFiles, setShowHiddenFiles] = createSignal<boolean>(false);
  const filters = createMemo<RegExp[]>(() => showHiddenFiles() ? [/^node_modules$/] : [/^node_modules$/, /^\..+$/]);
  const [root, { mutate, refetch }] = createResource(() => files?.get('root'));

  createEffect(() => {
    setState('numberOfFiles', state.files.length);
  });

  // Since the files are stored in indexedDb we need to refetch on the client in order to populate on page load
  onMount(() => {
    refetch();
  });

  createEffect(async () => {
    const directory = root();

    if (root.state === 'ready' && directory?.kind === 'directory') {
      const entries = await Array.fromAsync(walk(directory, filters()));

      setTree({ name: '', kind: 'folder', entries });
    }
  });

  const open = async (file: File) => {
    setState('files', produce(files => {
      files.push(file);
    }));
  };

  const commands = {
    open: createCommand('open', async () => {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "JSON File(s)",
            accept: {
              "application/json": [".json", ".jsonp", ".jsonc"],
            },
          }
        ],
        excludeAcceptAllOption: true,
        multiple: true,
      });
      const file = await fileHandle.getFile();
      const text = await file.text();

      console.log(fileHandle, file, text);
    }, { key: 'o', modifier: Modifier.Control }),
    openFolder: createCommand('openFolder', async () => {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
      const entries = await Array.fromAsync(walk(directory, filters()));

      files.set('root', directory);
      mutate(directory);

      setTree({ name: '', kind: 'folder', entries });
    }),
    save: createCommand('save', () => {
      console.log('save');
    }, { key: 's', modifier: Modifier.Control }),
    saveAll: createCommand('save all', () => {
      console.log('save all');
    }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
  } as const;

  return (
    <>
      <Menu.Root>
        <Menu.Item label="file">
          <Menu.Item label="open" command={commands.open} />

          <Menu.Item label="open folder" command={commands.openFolder} />

          <Menu.Item label="save" command={commands.save} />

          <Menu.Item label="save all" command={commands.saveAll} />
        </Menu.Item>
      </Menu.Root>

      <section class="index">
        <aside>
          <label><input type="checkbox" on:input={() => setShowHiddenFiles(v => !v)} />Show hidden files</label>
          <Tree entries={tree().entries} open={open}>{
            file => file().name
          }</Tree>
        </aside>

        <section>
          <Tabs>
            <For each={state.files}>{
              file => <Tab label={file.name}>
                <Content file={file} />
              </Tab>
            }</For>
          </Tabs>
        </section>
      </section>
    </>
  );
}

const Content: Component<{ file: File }> = (props) => {
  const [content] = createResource(async () => {
    return await props.file.text();
  });

  return <Suspense fallback={'loading'}>
    <pre>{content()}</pre>
  </Suspense>
};