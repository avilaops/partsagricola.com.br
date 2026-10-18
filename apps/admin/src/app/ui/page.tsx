import {
  Button,
  Card,
  Combobox,
  ConditionBadge,
  DashboardSidebar,
  DataTable,
  EmptyState,
  Input,
  MarketplaceHeader,
  Modal,
  PhotoUploader,
  Price,
  Rating,
  Select,
  Skeleton,
  Stepper,
  StoreAvatar,
  Tabs,
  Toast,
  TrustFooter,
} from "@partsagricola/ui";

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="pa-section">
    <h2>{title}</h2>
    <p className="pa-section-intro">{description}</p>
    {children}
  </section>
);

export default function UiPage() {
  return (
    <div className="shell">
      <MarketplaceHeader />
      <main id="conteudo" className="content">
        <p className="eyebrow">AVL-170 · biblioteca compartilhada</p>
        <h1>Design system Parts Agrícola</h1>
        <p className="description">
          Componentes consistentes para o marketplace B2B, os painéis de
          anunciantes e a operação administrativa.
        </p>
        <Section
          title="Identidade e tokens"
          description="Verde oficial recuperado da marca; dourado reservado a foco, avaliação e atenção."
        >
          <div className="pa-grid">
            <div
              className="token-swatch"
              style={{ background: "var(--pa-color-brand)" }}
            >
              Verde marca · #0B6B3F
            </div>
            <div
              className="token-swatch"
              style={{ background: "var(--pa-color-action-strong)" }}
            >
              Verde ação · #188A4B
            </div>
            <div
              className="token-swatch"
              style={{ background: "var(--pa-color-gold)" }}
            >
              Dourado · #C69214
            </div>
            <div
              className="token-swatch token-swatch--canvas"
              style={{ background: "var(--pa-color-canvas)" }}
            >
              Superfície · #F5F7F6
            </div>
          </div>
        </Section>
        <Section
          title="Ações"
          description="Hierarquia clara sem padrões de carrinho ou checkout."
        >
          <div className="pa-row">
            <Button>Publicar anúncio</Button>
            <Button variant="secondary">Salvar rascunho</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Excluir anúncio</Button>
          </div>
        </Section>
        <Section
          title="Formulários"
          description="Campos, seleção e busca com rótulos e mensagens acessíveis."
        >
          <div className="pa-grid">
            <Input
              label="Título do anúncio"
              placeholder="Ex.: Colheitadeira 2022"
              hint="Use uma descrição objetiva."
            />
            <Input
              label="Preço"
              placeholder="R$ 0,00"
              error="Informe um valor válido."
            />
            <Select label="Condição">
              <option>Nova</option>
              <option>Usada</option>
            </Select>
            <Combobox
              label="Marca"
              options={[
                "John Deere",
                "Massey Ferguson",
                "New Holland",
                "Valtra",
              ]}
            />
          </div>
        </Section>
        <Section
          title="Publicação"
          description="Etapas e upload de fotos para o cadastro do anúncio."
        >
          <Stepper
            steps={["Categoria", "Detalhes", "Fotos", "Revisão"]}
            current={2}
          />
          <div style={{ height: "2rem" }} />
          <PhotoUploader />
        </Section>
        <Section
          title="Anúncio e reputação"
          description="Informação comercial apresentada sem assumir que a plataforma é a lojista."
        >
          <div className="pa-grid">
            <Card>
              <ConditionBadge condition="used" />
              <h3>Plantadeira 12 linhas</h3>
              <Price amountMinor={23500000} />
              <p>
                Alternativa: <Price amountMinor={null} />
              </p>
              <Rating value={4.7} reviews={32} />
            </Card>
            <Card>
              <div className="pa-row">
                <ConditionBadge condition="new" />
                <ConditionBadge condition="reviewed" />
                <ConditionBadge condition="remanufactured" />
              </div>
              <h3>Empresa anunciante</h3>
              <StoreAvatar name="Agro Máquinas Sul" verified />
              <p className="pa-hint">Empresa e identidade verificadas.</p>
            </Card>
          </div>
        </Section>
        <Section
          title="Estados e feedback"
          description="Carregamento, vazio, notificações e confirmação."
        >
          <div className="pa-grid">
            <Card>
              <Skeleton />
              <br />
              <Skeleton />
              <br />
              <Skeleton />
            </Card>
            <Card>
              <EmptyState
                title="Nenhum anúncio"
                description="Sua empresa ainda não publicou anúncios."
                action={<Button>Começar anúncio</Button>}
              />
            </Card>
            <div>
              <Toast>Alterações salvas.</Toast>
              <br />
              <Toast tone="warning">Cadastro pendente de revisão.</Toast>
            </div>
            <Card>
              <Modal trigger="Revisar publicação" title="Publicar anúncio?">
                <p>O anúncio ficará visível no marketplace após a revisão.</p>
              </Modal>
            </Card>
          </div>
        </Section>
        <Section
          title="Navegação e dados"
          description="Tabs, menu lateral e tabela responsiva para gestão."
        >
          <Tabs
            items={[
              { label: "Ativos", content: <p>12 anúncios ativos</p> },
              { label: "Pausados", content: <p>2 anúncios pausados</p> },
            ]}
          />
          <div className="pa-grid">
            <DashboardSidebar area="Painel do anunciante" />
            <DataTable
              caption="Últimos anúncios"
              columns={["Anúncio", "Empresa", "Status"]}
              rows={[
                [
                  "Trator 6110J",
                  "Agro Máquinas Sul",
                  <ConditionBadge key="a" condition="used" />,
                ],
                [
                  "Pulverizador 3030",
                  "Campo Forte",
                  <ConditionBadge key="b" condition="reviewed" />,
                ],
              ]}
            />
          </div>
        </Section>
      </main>
      <TrustFooter />
    </div>
  );
}
