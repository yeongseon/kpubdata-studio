import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { BuildsPage } from "@/pages/BuildsPage";
import { HomePage } from "@/pages/HomePage";
import { NewBuildPage } from "@/pages/NewBuildPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
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
