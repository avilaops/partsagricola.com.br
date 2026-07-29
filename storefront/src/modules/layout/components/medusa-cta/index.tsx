import { Text } from "@medusajs/ui"

const MedusaCTA = () => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      by{" "}
      <a
        href="https://avila.inc"
        target="_blank"
        rel="noreferrer"
        className="hover:text-ui-fg-base"
      >
        Avila Ops
      </a>
    </Text>
  )
}

export default MedusaCTA
