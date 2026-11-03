// Valida o HTML do site com html-validate e so com a config de .github/ci/htmlvalidate.cjs.
// Uso: node .github/ci/validate-html.mjs [raiz]   (padrao: diretorio atual)
// Fecha os jeitos de neutralizar o check fora de .github/:
// - StaticConfigLoader: nao procura `.htmlvalidate*` em cascata no repo (o --config do CLI procura);
// - reprova se existir `.htmlvalidate*` fora de .github/ (mesmo ignorado, nao deve existir);
// - reprova diretiva inline (`<!-- [html-validate-disable...] -->`, `<!-- html-validate-... -->`) em qualquer .html.
// Saida 0 = ok (avisos aparecem, nao reprovam); 1 = erro.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { HtmlValidate, StaticConfigLoader, formatterFactory } from "html-validate";

const require = createRequire(import.meta.url);
const config = { ...require("./htmlvalidate.cjs"), root: true };
const root = path.resolve(process.argv[2] || ".");
const IGNORAR_DIRS = new Set([".git", ".github", "node_modules"]);
const DIRETIVA = /<!--\s*\[?\s*html-validate-/gi;

function listar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR_DIRS.has(nome)) continue;
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) listar(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const arquivos = listar(root);
const paginas = arquivos.filter((p) => /\.html?$/i.test(p));
const proibidos = [];

for (const p of arquivos) {
  if (/^\.htmlvalidate/i.test(path.basename(p))) proibidos.push(`${rel(p)}: config do html-validate fora de .github/`);
}
for (const p of paginas) {
  const texto = readFileSync(p, "utf8");
  for (const m of texto.matchAll(DIRETIVA)) {
    const linha = texto.slice(0, m.index).split("\n").length;
    proibidos.push(`${rel(p)}:${linha}: diretiva inline do html-validate`);
  }
}

const htmlvalidate = new HtmlValidate(new StaticConfigLoader(config));
const resultados = [];
let erros = 0;
for (const p of paginas) {
  const report = await htmlvalidate.validateFile(p);
  erros += report.errorCount;
  resultados.push(...report.results);
}

const saida = formatterFactory("stylish")(resultados);
if (saida.trim()) console.log(saida);
if (proibidos.length) {
  console.error(`validate-html: ${proibidos.length} item(ns) proibido(s):`);
  for (const x of proibidos) console.error("  " + x);
}
if (erros || proibidos.length) process.exit(1);
console.log(`validate-html: ok, ${paginas.length} pagina(s) validada(s).`);
