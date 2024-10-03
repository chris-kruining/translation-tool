import { Component, createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { useFiles } from "~/features/file";
import { createCommand, Menu, Modifier } from "~/features/menu";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";
import "./experimental.css";

interface FileEntry {
  name: string;
  kind: 'file';
  meta: File;
}

interface FolderEntry {
  name: string;
  kind: 'folder';
  entries: Entry[];
}

type Entry = FileEntry | FolderEntry;

async function* walk(directory: FileSystemDirectoryHandle, filters: RegExp[] = [], depth = 0): AsyncGenerator<Entry, void, never> {
  if (depth === 10) {
    return;
  }

  for await (const handle of directory.values()) {

    if (filters.some(f => f.test(handle.name))) {
      continue;
    }

    if (handle.kind === 'file') {
      yield { name: handle.name, kind: 'file', meta: await handle.getFile() };
    }
    else {
      yield { name: handle.name, kind: 'folder', entries: await Array.fromAsync(walk(handle, filters, depth + 1)) };
    }
  }
}

export default function Index() {
  const files = useFiles();
  const [tree, setTree] = createSignal<FolderEntry>();
  const [content, setContent] = createSignal<string>('');
  const [showHiddenFiles, setShowHiddenFiles] = createSignal<boolean>(false);
  const filters = createMemo<RegExp[]>(() => showHiddenFiles() ? [/^node_modules$/] : [/^node_modules$/, /^\..+$/]);
  const [root, { mutate, refetch }] = createResource(() => files.get('root'));

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
    const text = await file.text();

    console.log({ file, text });

    return setContent(text);
  };

  const commands = {
    open: createCommand(async () => {
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
    openFolder: createCommand(async () => {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
      const entries = await Array.fromAsync(walk(directory, filters()));

      files.set('root', directory);
      mutate(directory);

      setTree({ name: '', kind: 'folder', entries });
    }),
    save: createCommand(() => {
      console.log('save');
    }, { key: 's', modifier: Modifier.Control }),
    saveAll: createCommand(() => {
      console.log('save all');
    }, { key: 's', modifier: Modifier.Control | Modifier.Shift }),
    edit: createCommand(() => { }),
    selection: createCommand(() => { }),
    view: createCommand(() => { }),
  } as const;

  const Tree: Component<{ entries: Entry[] }> = (props) => {
    return <ul style="display: flex; flex-direction: column; list-style: none;">
      <For each={props.entries}>{
        (entry, index) => <li style={`order: ${(entry.kind === 'file' ? 200 : 100) + index()}`}>
          <Show when={entry.kind === 'folder' ? entry : undefined}>{
            folder => <Folder folder={folder()} />
          }</Show>

          <Show when={entry.kind === 'file' ? entry : undefined}>{
            file => <span on:pointerdown={() => {
              console.log(`lets open '${file().name}'`);

              open(file().meta);
            }}><AiFillFile /> {file().name}</span>
          }</Show>
        </li>
      }</For>
    </ul>
  }

  const Folder: Component<{ folder: FolderEntry }> = (props) => {
    const [open, setOpen] = createSignal(false);

    return <details open={open()} on:toggle={() => setOpen(o => !o)}>
      <summary><Show when={open()} fallback={<AiFillFolder />}><AiFillFolderOpen /></Show> {props.folder.name}</summary>
      <Tree entries={props.folder.entries} />
    </details>;
  };

  return (
    <>
      <Menu.Root>
        <Menu.Item label="file">
          <Menu.Item label="open" command={commands.open} />

          <Menu.Item label="open folder" command={commands.openFolder} />

          <Menu.Item label="save" command={commands.save} />

          <Menu.Item label="save all" command={commands.saveAll} />
        </Menu.Item>

        <Menu.Item label="edit" command={commands.edit} />

        <Menu.Item label="selection" command={commands.selection} />

        <Menu.Item label="view" command={commands.view} />
      </Menu.Root>

      <section class="index">
        <aside>
          <label><input type="checkbox" on:input={() => setShowHiddenFiles(v => !v)} />Show hidden files</label>
          <Show when={tree()}>{
            tree => <Tree entries={tree().entries} />
          }</Show>
        </aside>

        <section>
          <pre>{content()}</pre>
        </section>
      </section>
    </>
  );
}
