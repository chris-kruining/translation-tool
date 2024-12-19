
import { ParentProps } from "solid-js";
import { Menu } from "~/features/menu";
import { createCommand } from "~/features/command";
import { useNavigate } from "@solidjs/router";

export default function Experimental(props: ParentProps) {
  const navigate = useNavigate();

  const goTo = createCommand('go to', (to: string) => {
    navigate(`/experimental/${to}`);
  });

  return <>
    <Menu.Root>
      <Menu.Item command={goTo.withLabel('table').with('table')} />
      <Menu.Item command={goTo.withLabel('grid').with('grid')} />
    </Menu.Root>

    {props.children}
  </>;
}