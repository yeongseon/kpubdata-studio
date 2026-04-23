import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useUIStore } from "@/shared/hooks/useUIStore";

const primaryNavItems = [
  { to: "/builds/new", label: "New Build", description: "Create a fresh spec" },
  { to: "/builds", label: "Runs", description: "Track executions" },
  { to: "/artifacts", label: "Artifacts", description: "Inspect outputs" },
  { to: "/settings", label: "Settings", description: "Configure Studio" },
] as const;

const utilityNavItems = [
  { to: "/validate", label: "Validate" },
  { to: "/preview", label: "Preview" },
] as const;

function getResolvedTheme(theme: ReturnType<typeof useUIStore.getState>["theme"]):
  | "light"
  | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
}

function navigationClassName({ isActive }: { isActive: boolean }) {
  return [
    "group flex items-start justify-between gap-3 rounded-3xl border px-4 py-3 text-left transition",
    isActive
      ? "border-zinc-900 bg-zinc-900 text-white shadow-lg shadow-zinc-950/10 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
      : "border-zinc-200/80 bg-white/70 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-950",
  ].join(" ");
}

export function Layout() {
  const closeSidebar = useUIStore((state) => state.closeSidebar);
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const setTheme = useUIStore((state) => state.setTheme);
  const theme = useUIStore((state) => state.theme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  useEffect(() => {
    document.documentElement.dataset.theme = getResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {isSidebarOpen ? (
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-zinc-950/45 lg:hidden"
            onClick={closeSidebar}
            type="button"
          />
        ) : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-[18.5rem] flex-col border-r border-zinc-200/70 bg-white/90 px-5 py-5 backdrop-blur transition-transform dark:border-zinc-800 dark:bg-zinc-950/90 lg:static lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 pb-5 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
                KPubData Studio
              </p>
              <Link className="mt-2 block text-2xl font-semibold tracking-tight" to="/">
                Workflow Atelier
              </Link>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Draft, validate, preview, and ship builder specs from one shell.
              </p>
            </div>
            <button
              aria-label="Close sidebar"
              className="rounded-full border border-zinc-200 p-2 text-zinc-500 lg:hidden dark:border-zinc-800 dark:text-zinc-300"
              onClick={closeSidebar}
              type="button"
            >
              ✕
            </button>
          </div>

          <nav className="mt-6 flex flex-1 flex-col gap-6">
            <div className="space-y-3">
              {primaryNavItems.map((item) => (
                <NavLink
                  className={navigationClassName}
                  key={item.to}
                  onClick={closeSidebar}
                  to={item.to}
                >
                  <div>
                    <p className="font-medium tracking-tight">{item.label}</p>
                    <p className="mt-1 text-sm opacity-80">{item.description}</p>
                  </div>
                  <span className="mt-1 text-xs uppercase tracking-[0.25em] opacity-60">
                    Open
                  </span>
                </NavLink>
              ))}
            </div>

            <div className="rounded-3xl border border-dashed border-zinc-300/80 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                Workspace panels
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {utilityNavItems.map((item) => (
                  <NavLink
                    className={({ isActive }) =>
                      [
                        "rounded-full border px-3 py-2 text-sm transition",
                        isActive
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
                      ].join(" ")
                    }
                    key={item.to}
                    onClick={closeSidebar}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          <div className="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Keep the shell legible while scaffolding new workflows.
                </p>
              </div>
              <select
                aria-label="Select theme"
                className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}
                value={theme}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
          <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Toggle sidebar"
                  className="inline-flex rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 shadow-sm lg:hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  onClick={toggleSidebar}
                  type="button"
                >
                  ☰
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                    Builder control surface
                  </p>
                  <h1 className="text-lg font-semibold tracking-tight">
                    Portable dataset workflows for students and maintainers
                  </h1>
                </div>
              </div>

              <Link
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
                to="/builds/new"
              >
                Start new build
              </Link>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
