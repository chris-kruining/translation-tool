import { Menu } from "~/features/menu";

export default function Index() {
  return (
    <>
      <Menu.Root>
        <Menu.Item label="file">
          <Menu.Item label="open" />

          <Menu.Item label="save" />
        </Menu.Item>

        <Menu.Item label="edit" />

        <Menu.Item label="selection" />

        <Menu.Item label="view" />
      </Menu.Root>
    </>
  );
}
