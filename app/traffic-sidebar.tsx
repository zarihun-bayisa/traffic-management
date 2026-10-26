import Link from "next/link";

const menuItems = [
  "Dashboard",
  "Vehicles",
  "Agreements",
  "Traffic Cameras",
  "Violations",
  "Drivers",
  "Reports",
];

export default function TrafficSidebar({
  activeItem,
  onTabSelect,
}: {
  activeItem: string;
  onTabSelect?: (item: string) => void;
}) {
  return (
    <aside className="hidden w-72 shrink-0 bg-slate-900 p-6 text-white md:block">
      <Link href="/" className="block">
        <h1 className="text-xl font-bold">Traffic Control</h1>
        <p className="mb-8 mt-2 text-sm text-slate-400">Management System</p>
      </Link>

      <nav className="space-y-2" aria-label="Main navigation">
        {menuItems.map((item) => {
          const isActive = activeItem === item;
          const itemClass = `block w-full rounded-lg px-4 py-3 text-left transition ${
            isActive
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`;

          if (item === "Traffic Cameras") {
            return (
              <Link
                key={item}
                href="/traffic-cameras"
                aria-current={isActive ? "page" : undefined}
                className={itemClass}
              >
                {item}
              </Link>
            );
          }

          if (item === "Dashboard") {
            return (
              <Link
                key={item}
                href="/"
                aria-current={isActive ? "page" : undefined}
                className={itemClass}
              >
                {item}
              </Link>
            );
          }

          if (item === "Agreements") {
            return (
              <Link
                key={item}
                href="/agreements"
                aria-current={isActive ? "page" : undefined}
                className={itemClass}
              >
                {item}
              </Link>
            );
          }

          if (item === "Violations") {
            return (
              <Link
                key={item}
                href="/violations"
                aria-current={isActive ? "page" : undefined}
                className={itemClass}
              >
                {item}
              </Link>
            );
          }

          if (item === "Drivers") {
            return (
              <Link
                key={item}
                href="/drivers"
                aria-current={isActive ? "page" : undefined}
                className={itemClass}
              >
                {item}
              </Link>
            );
          }

          if (onTabSelect) {
            return (
              <button
                key={item}
                type="button"
                onClick={() => onTabSelect(item)}
                className={itemClass}
              >
                {item}
              </button>
            );
          }

          return (
            <Link key={item} href={`/?tab=${encodeURIComponent(item)}`} className={itemClass}>
              {item}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 border-t border-slate-700 pt-5">
        <p className="text-xs text-slate-400">Traffic Management System</p>
        <p className="mt-1 text-xs text-slate-500">Administration Panel</p>
      </div>
    </aside>
  );
}