import { Container, clx } from "@medusajs/ui"
import Image from "next/image"
import React from "react"

type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  alt?: string
  /** código da peça: sem foto, o card vira placa técnica com o código */
  code?: string | null
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  className,
  alt = "Peça do catálogo Parts Agrícola",
  code,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 bg-ui-bg-subtle shadow-elevation-card-rest rounded-large group-hover:shadow-elevation-card-hover transition-shadow ease-in-out duration-150",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} alt={alt} code={code} />
    </Container>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
  alt,
  code,
}: Pick<ThumbnailProps, "size" | "alt" | "code"> & { image?: string }) => {
  if (image) {
    return (
      <Image
        src={image}
        alt={alt || "Peça do catálogo Parts Agrícola"}
        // contain, não cover: as fotos recortadas são quadradas com respiro —
        // cortar borda de peça técnica esconde exatamente o que identifica.
        className="absolute inset-0 object-contain object-center"
        draggable={false}
        quality={60}
        // Sem `unoptimized`: com ele, cada card da grade baixava o PNG cheio
        // do R2 (300–900 KB); o otimizador do Next serve WebP no tamanho certo.
        sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
        fill
      />
    )
  }
  if (code) {
    // Placa técnica: sem foto, o código é a identidade da peça — único por
    // produto, em vez do mesmo SVG genérico repetido pela grade inteira.
    return (
      <div
        aria-label={`Sem foto — código ${code}`}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(160deg,#f5f8f6,#eaf2ec)] px-3 text-center"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B6B3F]/60">
          Código
        </span>
        <span className="w-full break-all font-mono text-lg font-bold leading-tight text-[#1F2933] small:text-xl">
          {code}
        </span>
        <span className="text-[10px] leading-4 text-ui-fg-muted">
          foto em catalogação · ficha técnica disponível
        </span>
      </div>
    )
  }
  return (
    <Image
      src="/images/catalog/produto-sem-imagem.svg"
      alt={`Imagem ainda não disponível para ${alt || "esta peça"}`}
      className="absolute inset-0 object-cover object-center"
      draggable={false}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  )
}

export default Thumbnail
