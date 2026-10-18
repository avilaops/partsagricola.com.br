import { AppShell } from "@partsagricola/ui";
import Link from "next/link";
export default function Page() {
  return (
    <>
      <AppShell
        area="Marketplace"
        description="Encontre peças agrícolas por aplicação, código ou medida técnica."
      />
      <Link href="/conversas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?evidence=1">
        Abrir conversa segura
      </Link>
    </>
  );
}
