import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Game = lazy(() => import("@/game/Game"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ilha Viva — Construa sua ilha tropical em 3D" },
      { name: "description", content: "Plante árvores, construa casas, crie lagos e solte animais numa ilha tropical low poly em 3D." },
      { property: "og:title", content: "Ilha Viva — Construa sua ilha tropical em 3D" },
      { property: "og:description", content: "Um jogo de construção de ilha low poly no navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Suspense fallback={<div className="game-sky fixed inset-0" />}>
      <Game />
    </Suspense>
  ),
});
