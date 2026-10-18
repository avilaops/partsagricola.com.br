import { ContentReportButton } from "../../components/content-report-button";

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ evidence?: string }>;
}) {
  const id = (await params).id;
  const evidence =
    (await searchParams).evidence === "1" &&
    process.env.NODE_ENV !== "production";
  return (
    <main>
      <h1>Empresa anunciante</h1>
      <p>Consulte a reputação da empresa antes de negociar.</p>
      <ContentReportButton
        targetType="STORE"
        targetId={id}
        evidence={evidence}
      />
    </main>
  );
}
