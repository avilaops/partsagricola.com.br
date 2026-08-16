"use client"

import { TechnicalProductType } from "@lib/data/technical-search"
import { usePathname, useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

type DimensionValues = {
  internal: string
  section: string
  shaft: string
  external: string
  height: string
}

type DimensionSearchFormProps = {
  initialType: TechnicalProductType
  initialValues: DimensionValues
}

const PRODUCT_TYPES: Array<{
  value: TechnicalProductType
  label: string
  description: string
}> = [
  {
    value: "oring",
    label: "O-Ring",
    description: "Diâmetro interno e seção",
  },
  {
    value: "retentor",
    label: "Retentor",
    description: "Eixo, externo e altura",
  },
  {
    value: "gaxeta",
    label: "Gaxeta",
    description: "Interno, externo e altura",
  },
]

const EXAMPLES: Record<TechnicalProductType, DimensionValues> = {
  oring: {
    internal: "22",
    section: "1.3",
    shaft: "",
    external: "",
    height: "",
  },
  retentor: {
    internal: "",
    section: "",
    shaft: "50.8",
    external: "69.85",
    height: "5",
  },
  gaxeta: {
    internal: "68",
    section: "",
    shaft: "",
    external: "80",
    height: "4",
  },
}

const DimensionSearchForm = ({
  initialType,
  initialValues,
}: DimensionSearchFormProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const [type, setType] = useState<TechnicalProductType>(initialType)
  const [values, setValues] = useState(initialValues)

  const updateValue = (name: keyof DimensionValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const selectType = (nextType: TechnicalProductType) => {
    setType(nextType)
    setValues(EXAMPLES[nextType])
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams({ tipo: type })

    Object.entries(values).forEach(([name, value]) => {
      if (value.trim()) {
        params.set(name, value.trim().replace(",", "."))
      }
    })

    router.push(`${pathname}?${params.toString()}`)
  }

  const dimensionInput = (
    name: keyof DimensionValues,
    label: string,
    hint: string
  ) => (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ui-fg-base">
        {label}
      </span>
      <div className="relative">
        <input
          name={name}
          value={values[name]}
          onChange={(event) => updateValue(name, event.target.value)}
          inputMode="decimal"
          pattern="[0-9]+([.,][0-9]+)?"
          required
          placeholder={hint}
          aria-label={`${label} em milímetros`}
          className="h-12 w-full rounded-rounded border border-ui-border-base bg-white px-4 pr-12 text-base outline-none transition focus:border-[#0B6B3F] focus:ring-2 focus:ring-[#0B6B3F]/15"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-ui-fg-muted">
          mm
        </span>
      </div>
    </label>
  )

  return (
    <form onSubmit={submitSearch} className="rounded-2xl bg-white p-5 shadow-sm small:p-8">
      <fieldset>
        <legend className="text-lg font-semibold">1. Escolha o tipo da peça</legend>
        <div className="mt-4 grid grid-cols-1 gap-3 xsmall:grid-cols-3">
          {PRODUCT_TYPES.map((productType) => {
            const active = type === productType.value

            return (
              <button
                key={productType.value}
                type="button"
                onClick={() => selectType(productType.value)}
                aria-pressed={active}
                className={`rounded-large border p-4 text-left transition ${
                  active
                    ? "border-[#0B6B3F] bg-[#edf8f1] ring-1 ring-[#0B6B3F]"
                    : "border-ui-border-base hover:border-[#75af8d]"
                }`}
              >
                <span className="block font-semibold text-ui-fg-base">
                  {productType.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-ui-fg-subtle">
                  {productType.description}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mt-7 border-t border-ui-border-base pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <legend className="text-lg font-semibold">2. Informe as medidas</legend>
          <button
            type="button"
            onClick={() => setValues(EXAMPLES[type])}
            className="text-xs font-semibold text-[#0B6B3F] hover:underline"
          >
            Preencher exemplo
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xsmall:grid-cols-2 small:grid-cols-3">
          {type === "oring" ? (
            <>
              {dimensionInput("internal", "Diâmetro interno", "Ex.: 22")}
              {dimensionInput("section", "Seção", "Ex.: 1,3")}
            </>
          ) : null}
          {type === "retentor" ? (
            <>
              {dimensionInput("shaft", "Diâmetro do eixo", "Ex.: 50,8")}
              {dimensionInput("external", "Diâmetro externo", "Ex.: 69,85")}
              {dimensionInput("height", "Altura", "Ex.: 5")}
            </>
          ) : null}
          {type === "gaxeta" ? (
            <>
              {dimensionInput("internal", "Diâmetro interno", "Ex.: 68")}
              {dimensionInput("external", "Diâmetro externo", "Ex.: 80")}
              {dimensionInput("height", "Altura", "Ex.: 4")}
            </>
          ) : null}
        </div>
      </fieldset>

      <div className="mt-7 flex flex-col gap-3 border-t border-ui-border-base pt-6 xsmall:flex-row xsmall:items-center xsmall:justify-between">
        <p className="text-xs leading-5 text-ui-fg-subtle">
          Use ponto ou vírgula para medidas decimais.
        </p>
        <button
          type="submit"
          className="h-12 rounded-rounded bg-[#0B6B3F] px-7 font-semibold text-white transition hover:bg-[#075b31]"
        >
          Encontrar medida exata
        </button>
      </div>
    </form>
  )
}

export default DimensionSearchForm
