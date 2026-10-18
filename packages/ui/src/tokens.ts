export const tokens = {
  color: {
    brand: "#0B6B3F",
    brandStrong: "#084F30",
    action: "#2FBF71",
    actionStrong: "#188A4B",
    gold: "#C69214",
    graphite: "#1F2933",
    muted: "#64748B",
    canvas: "#F5F7F6",
    surface: "#FFFFFF",
    border: "#DCE4DF",
    success: "#18864B",
    warning: "#9A6700",
    danger: "#B42318",
    info: "#175CD3",
  },
  font: {
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
  },
  radius: {
    small: "0.5rem",
    medium: "0.75rem",
    large: "1rem",
    pill: "999px",
  },
  shadow: {
    small: "0 1px 2px rgb(31 41 51 / 8%)",
    medium: "0 12px 32px rgb(31 41 51 / 12%)",
  },
  motion: {
    fast: "120ms",
    normal: "200ms",
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
  dark: {
    canvas: "#07150C",
    surface: "#102B19",
    text: "#EDF7F0",
    muted: "#BED0C3",
    border: "#24442E",
  },
  space: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    6: "1.5rem",
    8: "2rem",
    12: "3rem",
  },
} as const;

export const themeCssVariables = `
  --pa-color-brand: ${tokens.color.brand};
  --pa-color-brand-strong: ${tokens.color.brandStrong};
  --pa-color-action: ${tokens.color.action};
  --pa-color-action-strong: ${tokens.color.actionStrong};
  --pa-color-gold: ${tokens.color.gold};
  --pa-color-text: ${tokens.color.graphite};
  --pa-color-muted: ${tokens.color.muted};
  --pa-color-canvas: ${tokens.color.canvas};
  --pa-color-surface: ${tokens.color.surface};
  --pa-color-border: ${tokens.color.border};
  --pa-color-success: ${tokens.color.success};
  --pa-color-warning: ${tokens.color.warning};
  --pa-color-danger: ${tokens.color.danger};
  --pa-color-info: ${tokens.color.info};
  --pa-font-body: ${tokens.font.body};
  --pa-font-display: ${tokens.font.display};
  --pa-radius-sm: ${tokens.radius.small};
  --pa-radius-md: ${tokens.radius.medium};
  --pa-radius-lg: ${tokens.radius.large};
  --pa-radius-pill: ${tokens.radius.pill};
  --pa-shadow-sm: ${tokens.shadow.small};
  --pa-shadow-md: ${tokens.shadow.medium};
  --pa-motion-fast: ${tokens.motion.fast};
  --pa-motion-normal: ${tokens.motion.normal};
  --pa-motion-easing: ${tokens.motion.easing};
`;
