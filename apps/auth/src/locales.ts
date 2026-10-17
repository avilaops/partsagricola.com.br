export type Locale = "pt-BR" | "es" | "en";

const messages = {
  "pt-BR": {
    title: "Acesse sua conta",
    subtitle: "Um só acesso para todo o marketplace agrícola",
    email: "E-mail ou CPF",
    password: "Senha",
    login: "Entrar",
    signup: "Criar conta",
    forgot: "Esqueci minha senha",
    social: "Continuar com",
  },
  es: {
    title: "Accede a tu cuenta",
    subtitle: "Un solo acceso para todo el marketplace agrícola",
    email: "Correo o CPF",
    password: "Contraseña",
    login: "Ingresar",
    signup: "Crear cuenta",
    forgot: "Olvidé mi contraseña",
    social: "Continuar con",
  },
  en: {
    title: "Sign in to your account",
    subtitle: "One account for the agricultural marketplace",
    email: "Email or CPF",
    password: "Password",
    login: "Sign in",
    signup: "Create account",
    forgot: "Forgot password",
    social: "Continue with",
  },
} as const;

export function resolveLocale(value?: string): Locale {
  const normalized = value?.toLowerCase();
  if (normalized?.startsWith("es")) return "es";
  if (normalized?.startsWith("en")) return "en";
  return "pt-BR";
}

export function translate(locale: Locale) {
  return messages[locale];
}
