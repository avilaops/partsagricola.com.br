export async function GET() {
  return new Response("Catálogo próprio desativado", {
    status: 410,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
