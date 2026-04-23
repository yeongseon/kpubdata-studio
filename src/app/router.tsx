import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
import { BuildsPage } from "@/pages/BuildsPage";
import { HomePage } from "@/pages/HomePage";
import { NewBuildPage } from "@/pages/NewBuildPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ValidatePage } from "@/pages/ValidatePage";

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
      {
        path: "validate",
        element: <ValidatePage />,
      },
      {
        path: "preview",
        element: <PreviewPage />,
      },
      {
        path: "artifacts",
        element: <ArtifactsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
