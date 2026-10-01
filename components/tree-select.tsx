/** <option>s for a tree, indented by depth (for location / asset pickers). */
export function TreeOptions({ options }: { options: { id: string; name: string; depth: number }[] }) {
  return (
    <>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {"   ".repeat(o.depth)}
          {o.depth > 0 ? "└ " : ""}
          {o.name}
        </option>
      ))}
    </>
  );
}
