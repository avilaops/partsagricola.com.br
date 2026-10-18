import { ContentReportButton } from "../../components/content-report-button";

export default async function ListingPage({
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
      <h1>Anúncio do marketplace</h1>
      <p>Negocie dentro da plataforma e denuncie conteúdo inadequado.</p>
      <ContentReportButton
        targetType="LISTING"
        targetId={id}
        evidence={evidence}
      />
    </main>
  );
}
