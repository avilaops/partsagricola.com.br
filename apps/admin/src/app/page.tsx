import { AppShell, Button } from "@partsagricola/ui";
import Link from "next/link";
export default function Page() {
  return (
    <>
      <AppShell
        area="Administração"
        description="Controle operacional e auditoria do marketplace em uma interface central."
      />
      <div style={{ position: "fixed", right: "1rem", bottom: "1rem" }}>
        <Link href="/administracao/catalogo">
          <Button>Gerenciar catálogo</Button>
        </Link>
      </div>
    </>
  );
}
