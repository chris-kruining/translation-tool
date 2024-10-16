import { Component, createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { useFiles } from "~/features/file";
import { AiFillFile, AiFillFolder, AiFillFolderOpen } from "solid-icons/ai";
import { A } from "@solidjs/router";
import css from "./index.module.css";

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
  return (
    <main class={css.main}>
      <h1>Hi, welcome!</h1>
      <b>Lets get started</b>

      <ul>
        <li><A href="/edit">Start editing</A></li>
        <li><A href="/experimental">Try new features</A></li>
      </ul>
    </main>
  );
}
