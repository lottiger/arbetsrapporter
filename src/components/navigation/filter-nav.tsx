import Link from "next/link";

export type FilterOption = { value: string; label: string; title: string; description: string };

export function resolveFilter(value: string | string[] | undefined, options: readonly FilterOption[]) {
  return options.find((option) => option.value === value) ?? options[0];
}

export function FilterNav({ label, basePath, options, selected }: { label: string; basePath: string; options: readonly FilterOption[]; selected: string }) {
  return (
    <nav className="filter-nav" aria-label={label}>
      {options.map((option) => (
        <Link key={option.value} href={{ pathname: basePath, query: { status: option.value } }} aria-current={option.value === selected ? "page" : undefined} scroll={false}>
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
