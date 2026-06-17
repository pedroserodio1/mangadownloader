# manga-downloader

CLI em Node.js para baixar capítulos em PDF de light novels, com arquitetura de plugins e configuração interativa. O mesmo projeto também expõe um servidor [MCP](https://modelcontextprotocol.io) para uso por agentes de IA (Cursor, Claude Desktop, etc.).

Fontes disponíveis: [Central Novel](https://centralnovel.com), [MangaDex](https://mangadex.org) e outras via plugins em `plugins/`.

## Início rápido

```bash
pnpm install
pnpm init          # wizard interativo → gera config.json
pnpm start         # baixa os volumes configurados
```

Para agentes de IA, configure o MCP (seção abaixo) e use as tools `config_create`, `download`, `review`, etc.

## Requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- [pnpm](https://pnpm.io/) (recomendado) ou npm

## Instalação

```bash
git clone <url-do-repositorio>
cd baixar-centralnovel
pnpm install
```

## Configuração interativa

```bash
pnpm init
# ou
node bin/manga-downloader.js init
```

Para alterar volumes, pasta ou URL depois:

```bash
pnpm config
# ou
node bin/manga-downloader.js config
```

O wizard pergunta:

1. **Fonte** — plugin disponível (ex.: Central Novel)
2. **Pasta base** — onde os volumes serão salvos (`Vol 1/`, `Vol 2/`, …)
3. **Campos do plugin** — para Central Novel: URL da série, volumes (multiselect com catálogo real do site) e **formato de saída**
4. **Nome da série** (opcional)

A configuração é salva em `config.json`.

### Estrutura do config

```json
{
  "source": "centralnovel",
  "pastaBase": "D:\\Biblioteca\\Novels",
  "pluginConfig": {
    "serieUrl": "https://centralnovel.com/series/nome/",
    "volumes": ["1", "2"],
    "outputFormat": "chapters"
  },
  "seriesName": "Nome da Série",
  "concurrency": 3
}
```

| Campo | Descrição |
|-------|-----------|
| `source` | ID do plugin (definido no `init`) |
| `pastaBase` | Pasta raiz dos downloads |
| `pluginConfig` | Configuração específica do plugin |
| `seriesName` | Nome nos arquivos PDF (opcional) |
| `concurrency` | Downloads simultâneos (padrão: `3`) |
| `pluginConfig.outputFormat` | Formato de saída (`chapters`, `volume-single`, `volume-single-only`) |

### Formatos de saída

| ID | Comportamento |
|----|----------------|
| `chapters` | Padrão — um PDF por capítulo em `Vol N/` |
| `volume-single` | Junta caps em `{pastaBase}/{Série} - Vol NN.pdf` e **mantém** os caps |
| `volume-single-only` | Igual ao anterior, mas **remove** os PDFs de capítulo após merge |

O download sempre grava caps individuais primeiro; o merge roda ao final de cada volume (se o formato exigir).

PDF único por volume:

```text
{pastaBase}/{Série} - Vol {nn}.pdf
```

Caps individuais (inalterado):

```text
{pastaBase}/Vol {n}/{Série} - Vol {nn} - Cap {nnn}.pdf
```

**Conversões irreversíveis:** não é possível separar o PDF único de volta em capítulos, nem recuperar caps removidos em `volume-single-only`. Use `manga-downloader convert` para converter volumes já baixados — o `convert` usa **apenas os PDFs locais** (sem consultar o site) e ordena caps compostos como `1-1-2` antes de `1-1-10`.

No **download** interativo, o CLI pergunta o formato de saída antes de baixar (ou use `--format`).

Quando um volume é baixado com sucesso, ele é removido automaticamente de `pluginConfig.volumes`.

## Uso via MCP

O servidor MCP oferece paridade com o CLI — downloads, review, rename, convert e gestão de config — sem prompts interativos. Ideal para Cursor, Claude Desktop e outros clientes compatíveis.

### Iniciar o servidor

```bash
pnpm mcp          # stdio (Cursor / Claude Desktop)
pnpm mcp:http     # HTTP em http://127.0.0.1:3847/mcp
```

### Configuração no Cursor

Adicione em `.cursor/mcp.json` (use o caminho absoluto do seu clone):

```json
{
  "mcpServers": {
    "manga-downloader": {
      "command": "node",
      "args": ["D:\\caminho\\para\\baixar-centralnovel\\bin\\mcp-server.js"]
    }
  }
}
```

### Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `MANGA_DOWNLOADER_CONFIG` | Caminho alternativo para `config.json` (padrão: raiz do projeto) |
| `MCP_HTTP_HOST` | Host do servidor HTTP (padrão: `127.0.0.1`) |
| `MCP_HTTP_PORT` | Porta HTTP (padrão: `3847`) |

### Tools

| Tool | Equivalente CLI | Descrição |
|------|-----------------|-----------|
| `plugins_list` | — | Lista plugins de fonte disponíveis |
| `config_get` | — | Lê `config.json` validado |
| `config_create` | `init` | Cria config sem wizard |
| `config_update` | `config` | Atualiza campos do config |
| `catalog_get` | wizard init/config | Carrega catálogo de volumes do plugin |
| `manga_search` | busca no init | Pesquisa mangá (ex.: MangaDex) |
| `download` | `download` | Baixa volumes configurados |
| `review` | `review` | Compara catálogo do site × arquivos locais |
| `rename` | `rename` | Renomeia PDFs para padrão Kindle |
| `convert` | `convert` | Converte arquivos locais para outro formato |

Opções comuns (`volume`, `dryRun`, `quiet`, `verbose`) aplicam-se a `download`, `review`, `rename` e `convert`. No MCP, `quiet` é `true` por padrão para manter o stdout limpo no transporte stdio.

### Recursos (resources)

| URI | Descrição |
|-----|-----------|
| `config://current` | Snapshot JSON do config validado |
| `plugin://{pluginId}` | Metadados do plugin, `setupFields` e `outputFormats` |

Documentação completa (schemas, Claude Desktop, HTTP remoto): [docs/MCP.md](docs/MCP.md).

## Uso

```bash
# Baixar volumes configurados
pnpm start

# Baixar apenas um volume
node bin/manga-downloader.js --volume 3

# Simular sem salvar
node bin/manga-downloader.js --dry-run

# Comparar catálogo do site com PDFs locais
pnpm review

# Renomear PDFs para padrão Kindle
pnpm rename

# Converter formato de saída (merge local)
pnpm convert
node bin/manga-downloader.js convert --format volume-single-only --volume 3

# Ajuda
node bin/manga-downloader.js --help
```

### Comandos

| Comando | Descrição |
|---------|-----------|
| `init` | Configuração interativa |
| `config` | Edita config existente (volumes, pasta, URL, etc.) |
| `download` | Baixa volumes (padrão) |
| `review` | Compara site × local |
| `rename` | Renomeia PDFs |
| `convert` | Converte PDFs locais para outro formato |

### Opções

| Opção | Descrição |
|-------|-----------|
| `--volume <n>` | Limita a um volume |
| `--format <id>` | Formato de saída (`convert`) |
| `--force` | Merge parcial com caps faltando (`convert`) |
| `--dry-run` | Simula sem alterar arquivos |
| `--quiet`, `-q` | Apenas erros e resumo |
| `--verbose` | Logs detalhados |
| `--help`, `-h` | Ajuda |

## Adicionar um plugin

1. Crie `plugins/<id>/index.js` exportando o contrato (`plugins/types.js`)
2. Implemente `parseSeriesPage`, `resolvePdfUrl` e `setupFields`
3. (Opcional) `outputFormats`, `enrichSetup` para multiselect dinâmico e `getChapterFilePatterns` para nomes legados
4. Rode `manga-downloader init` e escolha a nova fonte

## Testes

```bash
pnpm test
```

## Estrutura do projeto

```text
manga-downloader/
├── bin/manga-downloader.js   # Entry point CLI
├── bin/mcp-server.js         # Servidor MCP (stdio / HTTP)
├── config.json               # Config local (não versionado)
├── plugins/
│   ├── types.js              # Contrato dos plugins
│   └── centralnovel/         # Plugin Central Novel
├── lib/
│   ├── cli/                  # Parser de argumentos
│   ├── config/               # store, init, edit, programmatic
│   ├── mcp/                  # servidor MCP (handlers, execute)
│   ├── core/                 # naming, paths, catalog
│   ├── plugins/              # loader de plugins
│   ├── download/             # downloader
│   ├── review/               # reviewer
│   ├── rename/               # renamer
│   ├── output/               # merge, detect, finalize, formatos
│   ├── shared/               # http, errors, logger, utils, runtime
│   ├── ui/                   # progresso e prompts
│   └── commands/             # download, review, rename, convert
└── tests/
```

## Aviso

Este projeto é para uso pessoal. Respeite os termos de uso das fontes e os direitos autorais das obras.

## Licença

ISC

## Para desenvolvedores / agentes de IA

Documentação técnica em inglês para criação de plugins e manutenção do core:

- [AGENTS.md](AGENTS.md) — ponto de entrada para agentes
- [docs/](docs/) — arquitetura, plugins, config e comandos
- `.cursor/skills/` — workflows (create-plugin, use-cli, extend-core)
- `plugins/_template/` — scaffold para novos plugins
