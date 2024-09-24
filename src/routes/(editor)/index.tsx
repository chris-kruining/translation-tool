import { Menu, MenuItem } from "~/features/menu";

export default function Index() {
  return (
    <>
      <Menu>
        <MenuItem label="file">
          <MenuItem label="open" />

          <MenuItem label="save" />
        </MenuItem>

        <MenuItem label="edit" />

        <MenuItem label="selection" />

        <MenuItem label="view" />
      </Menu>
    </>
  );
}
