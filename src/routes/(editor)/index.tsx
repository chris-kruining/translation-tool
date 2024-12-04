import { useNavigate } from "@solidjs/router";
import { createEffect } from "solid-js";
import { useFiles } from "~/features/file";

export default function Index() {
  const navigate = useNavigate();
  const files = useFiles();

  createEffect(() => {
    const loading = files.loading();
    const root = files.root();

    if (loading) {
      return;
    }

    navigate(root !== undefined ? '/edit' : '/welcome');
  });

  return <section style="display: grid; place-content: center;">
    <span>Loading, one moment please</span>
  </section>;
}
