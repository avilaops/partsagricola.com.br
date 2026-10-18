"use client";
import { BRAND } from "@partsagricola/config";
import {
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatPrice, normalizeRating, type PriceValue } from "./format";
export { formatPrice, normalizeRating } from "./format";
export { themeCssVariables, tokens } from "./tokens";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      className={`pa-button pa-button--${variant} ${className}`}
      {...props}
    />
  );
}
export function Input({
  label,
  hint,
  error,
  id: suppliedId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generated = useId(),
    id = suppliedId ?? generated,
    messageId = `${id}-message`;
  return (
    <label className="pa-field" htmlFor={id}>
      <span>{label}</span>
      <input
        className="pa-input"
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? messageId : undefined}
        {...props}
      />
      {(error || hint) && (
        <small id={messageId} className={error ? "pa-error" : "pa-hint"}>
          {error ?? hint}
        </small>
      )}
    </label>
  );
}
export function Select({
  label,
  children,
  id: suppliedId,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId(),
    id = suppliedId ?? generated;
  return (
    <label className="pa-field" htmlFor={id}>
      <span>{label}</span>
      <select className="pa-input" id={id} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Combobox({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const matches = useMemo(
    () =>
      options.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase()),
      ),
    [options, value],
  );
  const open = Boolean(value) && matches.length > 0;
  function choose(item: string) {
    setValue(item);
    setActive(0);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      choose(matches[active] ?? matches[0]!);
    } else if (event.key === "Escape") {
      setValue("");
    }
  }
  return (
    <div className="pa-combobox">
      <Input
        label={label}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
      />
      {value && (
        <ul id={listId} role="listbox">
          {matches.map((item, index) => (
            <li key={item} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                {item}
              </button>
            </li>
          ))}
          {!matches.length && <li className="pa-hint">Nenhum resultado</li>}
        </ul>
      )}
    </div>
  );
}
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="pa-stepper" aria-label="Progresso">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          data-complete={index < current}
        >
          {index < current ? "✓" : index + 1}
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <article className={`pa-card ${className}`} {...props} />;
}
const conditions = {
  new: "Nova",
  used: "Usada",
  reviewed: "Revisada",
  remanufactured: "Remanufaturada",
} as const;
export function ConditionBadge({
  condition,
}: {
  condition: keyof typeof conditions;
}) {
  return (
    <span className={`pa-badge pa-badge--${condition}`}>
      {conditions[condition]}
    </span>
  );
}
export function Price(props: PriceValue) {
  return (
    <data className="pa-price" value={props.amountMinor ?? undefined}>
      {formatPrice(props)}
    </data>
  );
}
export function Rating({
  value,
  reviews,
}: {
  value: number;
  reviews?: number;
}) {
  const rating = normalizeRating(value);
  return (
    <span className="pa-rating" aria-label={`${rating} de 5 estrelas`}>
      ★ <strong>{rating.toFixed(1)}</strong>
      {reviews !== undefined && <small> ({reviews})</small>}
    </span>
  );
}
export function StoreAvatar({
  name,
  src,
  verified = false,
}: {
  name: string;
  src?: string;
  verified?: boolean;
}) {
  return (
    <span className="pa-avatar-wrap">
      {src ? (
        <img className="pa-avatar" src={src} alt="" />
      ) : (
        <span className="pa-avatar" aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      {verified && (
        <span
          className="pa-verified"
          aria-label="Empresa verificada"
          title="Empresa verificada"
        >
          ✓
        </span>
      )}
      <span>{name}</span>
    </span>
  );
}
export function PhotoUploader({
  label = "Fotos do anúncio",
}: {
  label?: string;
}) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<
    Array<{ name: string; url: string }>
  >([]);
  function update(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    setError(
      valid.length === selected.length ? "" : "Use apenas JPG, PNG ou WebP.",
    );
    setFiles(valid);
    Promise.all(
      valid.map(
        (file) =>
          new Promise<{ name: string; url: string }>((resolve) => {
            const reader = new FileReader();
            reader.addEventListener("load", () =>
              resolve({ name: file.name, url: String(reader.result) }),
            );
            reader.readAsDataURL(file);
          }),
      ),
    ).then(setPreviews);
  }
  function remove(name: string) {
    setFiles((current) => current.filter((file) => file.name !== name));
    setPreviews((current) => current.filter((item) => item.name !== name));
  }
  return (
    <div className="pa-uploader">
      <label htmlFor={inputId}>
        <strong>{label}</strong>
      </label>
      <span>Selecione JPG, PNG ou WebP</span>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={update}
      />
      {error && (
        <span className="pa-error" role="alert">
          {error}
        </span>
      )}
      {files.length > 0 && (
        <span role="status">
          {files.length} foto{files.length > 1 ? "s" : ""} selecionada
          {files.length > 1 ? "s" : ""}
        </span>
      )}
      {previews.length > 0 && (
        <span className="pa-upload-previews">
          {previews.map((preview) => (
            <span key={preview.name}>
              <img src={preview.url} alt={`Prévia de ${preview.name}`} />
              <button
                type="button"
                onClick={() => remove(preview.name)}
                aria-label={`Remover ${preview.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="pa-empty">
      <span aria-hidden="true">⌕</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton({ label = "Carregando" }: { label?: string }) {
  return (
    <span className="pa-skeleton" role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}
export function Toast({
  tone = "success",
  children,
}: {
  tone?: "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <div className={`pa-toast pa-toast--${tone}`} role="status">
      {children}
    </div>
  );
}
export function Modal({
  trigger = "Abrir modal",
  title,
  children,
}: {
  trigger?: string;
  title: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const close = () => dialogRef.current?.close();
  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        {trigger}
      </Button>
      <dialog
        ref={dialogRef}
        className="pa-modal"
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onMouseDown={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label="Fechar" onClick={close}>
            ×
          </button>
        </header>
        {children}
        <footer>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={close}>Confirmar</Button>
        </footer>
      </dialog>
    </>
  );
}
export function Tabs({
  items,
}: {
  items: Array<{ label: string; content: ReactNode }>;
}) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabsRef.current[next]?.focus();
  }
  return (
    <div className="pa-tabs">
      <div role="tablist" aria-label="Seções">
        {items.map((item, index) => (
          <button
            key={item.label}
            role="tab"
            id={`${baseId}-tab-${index}`}
            aria-controls={`${baseId}-panel-${index}`}
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            ref={(node) => {
              tabsRef.current[index] = node;
            }}
            onKeyDown={(event) => move(event, index)}
            onClick={() => setActive(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section
        id={`${baseId}-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
      >
        {items[active]?.content}
      </section>
    </div>
  );
}
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
}) {
  if (rows.some((row) => row.length !== columns.length)) {
    throw new Error(
      "Cada linha da DataTable deve ter o mesmo número de colunas.",
    );
  }
  return (
    <div className="pa-table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} data-label={columns[j]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function MarketplaceHeader() {
  return (
    <header className="pa-market-header">
      <a href="#conteudo" className="skip">
        Ir para o conteúdo
      </a>
      <a className="pa-brand" href="/" aria-label={`${BRAND.name}, início`}>
        <img src="/brand/simbolo-partsagricola.png" alt="" />
        <strong>{BRAND.name}</strong>
      </a>
      <form role="search">
        <label className="sr-only" htmlFor="market-search">
          Buscar no marketplace
        </label>
        <input
          id="market-search"
          type="search"
          placeholder="Buscar peça, máquina ou empresa"
        />
        <button type="submit">Buscar</button>
      </form>
      <nav aria-label="Conta">
        <a href="/login">Entrar</a>
      </nav>
    </header>
  );
}
export function DashboardSidebar({
  area = "Painel",
  items = ["Visão geral", "Anúncios", "Mensagens", "Empresa"],
}: {
  area?: string;
  items?: string[];
}) {
  return (
    <aside className="pa-sidebar">
      <strong>{area}</strong>
      <nav aria-label={area}>
        {items.map((item, index) => (
          <a
            key={item}
            href="#"
            aria-current={index === 0 ? "page" : undefined}
          >
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}
export function TrustFooter() {
  return (
    <footer className="pa-trust">
      <strong>Negocie com empresas verificadas</strong>
      <span>Ambiente seguro</span>
      <span>Suporte especializado</span>
      <span>Privacidade protegida</span>
      <small>
        © {new Date().getFullYear()} {BRAND.name}
      </small>
    </footer>
  );
}
export function AppShell({
  area,
  description,
  children,
}: {
  area: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="shell">
      <MarketplaceHeader />
      <main id="conteudo" className="content" tabIndex={-1}>
        <p className="eyebrow">Marketplace agrícola B2B</p>
        <h1>{area}</h1>
        <p className="description">{description}</p>
        {children ?? (
          <p className="state">Base pronta para a próxima entrega.</p>
        )}
      </main>
      <TrustFooter />
    </div>
  );
}
