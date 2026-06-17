export function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    command: "download",
    volume: null,
    format: null,
    dryRun: false,
    quiet: false,
    verbose: false,
    force: false,
    help: false,
  };

  const commands = new Set(["init", "config", "download", "review", "rename", "convert"]);
  let start = 0;

  if (argv[0] && commands.has(argv[0])) {
    options.command = argv[0];
    start = 1;
  }

  for (let i = start; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--quiet" || arg === "-q") {
      options.quiet = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--volume") {
      options.volume = argv[++i];
      if (!options.volume) {
        throw new Error("--volume requer um valor (ex.: --volume 3 ou --volume Extra).");
      }
      continue;
    }

    if (arg.startsWith("--volume=")) {
      options.volume = arg.slice("--volume=".length);
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--format") {
      options.format = argv[++i];
      if (!options.format) {
        throw new Error("--format requer um valor (ex.: --format volume-single).");
      }
      continue;
    }

    if (arg.startsWith("--format=")) {
      options.format = arg.slice("--format=".length);
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}. Use --help para ver opções.`);
  }

  if (options.quiet && options.verbose) {
    throw new Error("--quiet e --verbose não podem ser usados juntos.");
  }

  if (options.command === "review" && options.dryRun) {
    throw new Error("review e --dry-run não podem ser usados juntos.");
  }

  if ((options.command === "init" || options.command === "config") && options.volume) {
    throw new Error(`${options.command} não aceita --volume.`);
  }

  if (
    (options.command === "init" || options.command === "config") &&
    (options.format || options.force)
  ) {
    throw new Error(`${options.command} não aceita --format ou --force.`);
  }

  return options;
}

export function printHelp() {
  console.log(`
Uso: manga-downloader [comando] [opções]

Comandos:
  init              Configuração interativa (fonte, pasta, volumes)
  config            Edita config.json existente (volumes, pasta, URL, etc.)
  download          Baixa volumes do config (padrão)
  review            Compara catálogo do site com PDFs locais
  rename            Renomeia PDFs para formato Kindle
  convert           Converte PDFs locais para outro formato de saída

Opções:
  --volume <n>      Limita a um volume (ex.: 3 ou Extra)
  --format <id>     Formato de saída (download/convert; ex.: volume-single)
  --force           Merge parcial mesmo com caps faltando (convert)
  --dry-run         Simula sem alterar arquivos
  --quiet, -q       Mostra apenas erros e resumo
  --verbose         Logs detalhados por capítulo
  --help, -h        Exibe esta ajuda

Exemplos:
  manga-downloader init
  manga-downloader config
  manga-downloader
  manga-downloader download --volume 3
  manga-downloader review
  manga-downloader rename --dry-run
  manga-downloader convert --format volume-single-only
`);
}
