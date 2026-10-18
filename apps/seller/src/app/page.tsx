import { AppShell } from "@partsagricola/ui";
import Image from "next/image";
import Link from "next/link";
export default function Page() {
  return (
    <AppShell
      area="Área do vendedor"
      description="Publique o catálogo da sua própria empresa, apareça para compradores do setor e responda oportunidades em um único painel."
    >
      <section className="seller-landing-hero">
        <Image
          src="/images/seller-onboarding.png"
          alt="Empresa do setor agrícola administrando seu próprio catálogo"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1088px"
        />
        <div className="seller-landing-actions">
          <Link className="button link-button" href="/cadastro">
            Cadastrar minha empresa
          </Link>
          <Link className="button button-secondary link-button" href="/painel">
            Acessar painel
          </Link>
        </div>
      </section>

      <section className="home-section">
        <p className="eyebrow">O que a plataforma entrega</p>
        <h2>Uma vitrine comercial sem tomar o controle do seu estoque</h2>
        <div className="steps-grid">
          <article>
            <span>01</span>
            <strong>Perfil verificado</strong>
            <p>
              Apresente empresa, especialidades, localização e regiões
              atendidas.
            </p>
          </article>
          <article>
            <span>02</span>
            <strong>Catálogo próprio</strong>
            <p>
              Cadastre seus anúncios com fotos, condições, preço e
              disponibilidade.
            </p>
          </article>
          <article>
            <span>03</span>
            <strong>Oportunidades</strong>
            <p>
              Receba interesses, envie propostas e construa reputação com
              avaliações.
            </p>
          </article>
        </div>
      </section>

      <section className="seller-callout">
        <div>
          <p className="eyebrow">Comece pela verificação</p>
          <h2>Sua empresa vende. A PartsAgrícola conecta.</h2>
          <p>
            O cadastro passa por análise antes da publicação dos anúncios para
            proteger compradores e vendedores.
          </p>
        </div>
        <Link className="button link-button" href="/cadastro">
          Enviar cadastro
        </Link>
      </section>
    </AppShell>
  );
}
