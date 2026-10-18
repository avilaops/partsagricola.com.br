import { AppShell } from "@partsagricola/ui";
import Link from "next/link";
export default function Page() {
  return (
    <>
      <AppShell
        area="Área do fornecedor"
        description="Gerencie sua operação na PARTSAGRICOLA com uma visão objetiva e segura."
      />
      <Link
        href={`${process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000"}/conversas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`}
      >
        Abrir conversas
      </Link>
    </>
  );
}
