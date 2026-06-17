# Contribuindo

Obrigado por considerar contribuir com o **manga-downloader**. Este guia resume o fluxo de trabalho, as convenções do repositório e onde encontrar documentação técnica.

## Antes de começar

- Leia o [README.md](README.md) para entender o uso da CLI.
- Para detalhes de arquitetura e plugins, consulte [AGENTS.md](AGENTS.md) e a pasta [docs/](docs/).
- O projeto é para uso pessoal — respeite os termos das fontes e os direitos autorais das obras.

## Ambiente de desenvolvimento

**Requisitos:** Node.js 18+, [pnpm](https://pnpm.io/).

```bash
git clone <url-do-repositorio>
cd manga-downloader
pnpm install
cp config.example.json config.json   # Windows: copy config.example.json config.json
```

Edite `config.json` com caminhos locais para testar downloads. **Nunca commite `config.json`** — ele contém paths da sua máquina.

## Verificação rápida

Depois de qualquer alteração:

```bash
pnpm test
node bin/manga-downloader.js --help
node bin/manga-downloader.js init    # lista plugins descobertos
```

Os testes usam `node --test` e fixtures em `tests/fixtures/`. Não faça requisições a sites reais nos testes unitários.

## Onde colocar cada mudança

| Tipo de mudança | Local |
|-----------------|-------|
| Novo site ou fonte | `plugins/<id>/` |
| Lógica específica de um site | Dentro do plugin — **não** em `lib/` |
| Comportamento genérico da CLI | `lib/commands/`, `lib/download/`, `lib/output/`, etc. |
| Mensagens para o usuário | Português, nos comandos e prompts |
| Documentação técnica | Inglês, em `docs/` e `AGENTS.md` |

### Regras importantes

1. **`plugin.id` deve ser igual ao nome da pasta** em `plugins/` (validado pelo loader).
2. Plugins usam o cliente HTTP injetado (`ctx.http`) — não `fetch` direto.
3. Pastas em `plugins/` que começam com `_` (ex.: `_template/`) não são carregadas.
4. Mantenha diffs pequenos e siga o padrão de [`plugins/centralnovel/`](plugins/centralnovel/) como referência.

## Adicionar um plugin

1. Copie [`plugins/_template/`](plugins/_template/) para `plugins/<seu-id>/`.
2. Implemente o contrato em [`plugins/types.js`](plugins/types.js): `setupFields`, `parseSeriesPage`, `resolvePdfUrl`.
3. (Opcional) `enrichSetup`, `outputFormats`, `getChapterFilePatterns`, `chapterContentType`.
4. Adicione testes em `tests/plugins/<seu-id>.test.js` com fixtures HTML/JSON.
5. Rode `pnpm test` e confirme que o plugin aparece no `init`.

Guia completo: [docs/PLUGIN_AUTHORING.md](docs/PLUGIN_AUTHORING.md).

## Alterar o core

Mudanças em `lib/` afetam todas as fontes. Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) antes de alterar download, output, config ou loader.

Limitação conhecida: `lib/config/edit.js` ainda trata campos fixos (`serieUrl`, `volumes`, `outputFormat`). Plugins com campos customizados funcionam no `init`, mas podem precisar de ajustes no core para o comando `config`.

## Testes

Convenções (detalhes em `.cursor/rules/testing.mdc`):

- `node:test` + `node:assert/strict`
- Fixtures estáticas em `tests/fixtures/`
- Testes de loader: chame `clearPluginCache()` no `beforeEach`
- Para plugins: valide `parseSeriesPage`, helpers e o shape do contrato

Exemplos: `tests/plugins/centralnovel.test.js`, `tests/plugins/mangadex.test.js`, `tests/plugins/loader.test.js`.

## Commits e pull requests

- Prefira commits **pequenos e com um propósito claro** (ex.: `feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- Inclua testes quando o comportamento mudar.
- Descreva no PR: o que mudou, como testou e se há impacto em plugins existentes.
- Não inclua `config.json`, `node_modules/`, `.env` nem PDFs de download.

## Documentação

| Público | Idioma | Onde |
|---------|--------|------|
| Usuário final | Português | `README.md` |
| Desenvolvedor / agente | Inglês | `AGENTS.md`, `docs/` |
| Este guia | Português | `CONTRIBUTING.md` |

Ao documentar APIs ou arquitetura nova, atualize os arquivos em `docs/` em inglês.

## Dúvidas

Abra uma issue descrevendo o que pretende fazer (novo plugin, bug no core, melhoria na CLI). Para plugins, indique a fonte e se o catálogo é HTML, API ou híbrido.
