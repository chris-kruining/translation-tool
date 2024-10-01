import { createCommand, Menu, Modifier } from "~/features/menu";

export default function Index() {
  const commands = {
    open: createCommand(() => {
      console.log('Open a file');
    }, { key: 'o', modifier: Modifier.Control}),
    save: createCommand(() => {
      console.log('save');
    }, { key: 's', modifier: Modifier.Control }),
    saveAll: createCommand(() => {
      console.log('save all');
    }, { key: 's', modifier: Modifier.Control|Modifier.Shift }),
    edit: createCommand(() => {}),
    selection: createCommand(() => {}),
    view: createCommand(() => {}),
  } as const;

  return (
    <>
      <Menu.Root>
        <Menu.Item label="file">
          <Menu.Item label="open" command={commands.open} />

          <Menu.Item label="save" command={commands.save} />

          <Menu.Item label="save all" command={commands.saveAll} />
        </Menu.Item>

        <Menu.Item label="edit" command={commands.edit} />

        <Menu.Item label="selection" command={commands.selection} />

        <Menu.Item label="view" command={commands.view} />
      </Menu.Root>
    </>
  );
}
