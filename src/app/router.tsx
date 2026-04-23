import { createBrowserRouter, Link, Outlet } from "react-router-dom";
import { BuildsPage } from "@/pages/BuildsPage";
import { HomePage } from "@/pages/HomePage";
import { NewBuildPage } from "@/pages/NewBuildPage";

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              KPubData Studio
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Builder workflow control surface
            </h1>
          </div>

          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link className="rounded-full px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white" to="/">
              Home
            </Link>
            <Link className="rounded-full px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white" to="/builds">
              Builds
            </Link>
            <Link className="rounded-full bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200" to="/builds/new">
              New build
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "builds",
        element: <BuildsPage />,
      },
      {
        path: "builds/new",
        element: <NewBuildPage />,
      },
    ],
  },
]);
