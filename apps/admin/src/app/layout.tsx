import "@partsagricola/ui/styles.css";
import { BRAND } from "@partsagricola/config";
export const metadata = { title: `${BRAND.name} — Administração` };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
