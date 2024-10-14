import { createEffect, createMemo, createResource, createSignal, For, lazy, onMount, Suspense } from "solid-js";
import { useFiles } from "~/features/file";
import { Menu } from "~/features/menu";
import "./experimental.css";
import { createCommand, Modifier } from "~/features/command";
import { emptyFolder, FolderEntry, Tree, walk } from "~/components/filetree";
import { createStore, produce } from "solid-js/store";
import { Tab, Tabs, TabSimple, TabsSimple } from "~/components/tabs";

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
  const [root, { mutate, refetch }] = createResource(() => files.get('root'));

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

  const Content = lazy(async () => {
    const text = Promise.resolve('this is text');

    return { default: () => <>{text}</> };
  });

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
          <Tree entries={tree().entries}>{
            file => <span on:dblclick={() => open(file().meta)}>{file().name}</span>
          }</Tree>
        </aside>

        <section>
          <TabsSimple>
            <For each={state.files}>{
              file => <TabSimple label={file.name}>
                <pre>
                  <Suspense><Content /></Suspense>
                </pre>
              </TabSimple>
            }</For>
          </TabsSimple>
        </section>
      </section>
    </>
  );
}