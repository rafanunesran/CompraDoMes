import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CompraDoMes",
    short_name: "CompraDoMes",
    description: "Lista de compras do mês com comparação de preços entre mercados",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f5",
    theme_color: "#0f8a5f",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
