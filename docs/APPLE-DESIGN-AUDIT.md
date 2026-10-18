# Auditoria de interface — Apple Ávila

Data: 17/10/2026. Escopo: shells iniciais de `web`, `seller` e `admin`.

## Achados corrigidos

| Severidade | Evidência observável                                                            | Correção                                                                    | Teste de aceite                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Média      | O cabeçalho global estava dentro do landmark `main`.                            | Separação em `header` e `main`, com destino de skip link focalizável.       | O shell contém um cabeçalho e um conteúdo principal únicos; `#conteudo` recebe foco por teclado.                                 |
| Média      | `PARTSAGRICOLA` estava duplicado diretamente no componente.                     | O shell passou a consumir `BRAND.name` do pacote de configuração.           | O teste de contrato verifica o uso da configuração compartilhada.                                                                |
| Baixa      | Não havia tratamento explícito para contraste forçado ou ajuste de texto móvel. | Inclusão de `forced-colors` e `text-size-adjust`, preservando foco visível. | Lint, typecheck, testes e build devem passar; inspeção visual deve ser feita quando houver navegador/dispositivo de homologação. |

## Cobertura existente

- Hierarquia curta, estados vazios claros e navegação sem distrações.
- Tipografia fluida com unidades relativas.
- Layout responsivo a partir de 320 px.
- Modo claro, escuro e preferência de movimento reduzido.
- Skip link e foco visível para navegação por teclado.

Esta auditoria aplicou princípios das Human Interface Guidelines como referência.
Não houve teste em hardware Apple, VoiceOver real ou associação visual com marcas
da Apple.
