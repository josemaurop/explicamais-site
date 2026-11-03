// Checa links internos e assets do site, offline e sem dependencia.
// Uso: node .github/ci/check-links.mjs [raiz]   (padrao: diretorio atual)
// O que confere:
// - em todo *.html: href, src, srcset, poster e url() de <style>/style="" apontam para arquivo que existe;
//   "#id" e "pagina.html#id" apontam para um id (ou name) que existe na pagina alvo;
// - em todo *.css: url() e @import apontam para arquivo que existe (relativo ao proprio .css);
// - em *.html, *.css, *.xml e *.txt: URL absoluta do proprio dominio (arquivo CNAME) aponta para arquivo local
//   (aqui sem conferir o #fragmento: no texto livre ele pode ser identificador, ex.: "@id" do JSON-LD).
// Ignora: URL externa (http/https de outro host, //host), mailto:, tel:, data:, javascript:, href="#".
// Saida 0 = tudo certo; 1 = ha link quebrado (lista no stderr).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const IGNORAR_DIRS = new Set([".git", ".github", "node_modules"]);

function listar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR_DIRS.has(nome)) continue;
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) listar(p, out);
    else out.push(p);
  }
  return out;
}

const arquivos = listar(root);
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

let dominio = null;
const cnamePath = path.join(root, "CNAME");
if (existsSync(cnamePath)) dominio = readFileSync(cnamePath, "utf8").trim().toLowerCase() || null;

const decodificar = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const idsCache = new Map();
function idsDe(arquivoHtml) {
  if (!idsCache.has(arquivoHtml)) {
    const html = readFileSync(arquivoHtml, "utf8");
    const ids = new Set();
    for (const m of html.matchAll(/\s(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      ids.add(decodificar(m[1] ?? m[2] ?? m[3]));
    }
    idsCache.set(arquivoHtml, ids);
  }
  return idsCache.get(arquivoHtml);
}

const erros = [];
let conferidos = 0;

// Resolve um caminho do site (sem esquema) para arquivo local; devolve o path ou null.
function resolverLocal(urlPath, base) {
  let alvo;
  try {
    alvo = decodeURIComponent(urlPath);
  } catch {
    alvo = urlPath;
  }
  let abs = alvo === "" ? base : alvo.startsWith("/") ? path.join(root, alvo) : path.join(path.dirname(base), alvo);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = path.join(abs, "index.html");
  return existsSync(abs) ? abs : null;
}

function conferir(url, origem, contexto, checarFragmento = true) {
  url = decodificar(url.trim());
  if (!url || url === "#") return;
  if (/^(mailto:|tel:|data:|javascript:|sms:)/i.test(url)) return;
  if (url.startsWith("//")) return;
  const absoluta = url.match(/^https?:\/\/([^/?#]+)(.*)$/i);
  if (absoluta) {
    if (!dominio || absoluta[1].toLowerCase() !== dominio) return;
    url = absoluta[2] || "/";
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return;
  }
  conferidos++;
  const hashIdx = url.indexOf("#");
  const fragmento = hashIdx >= 0 ? url.slice(hashIdx + 1) : "";
  const semFrag = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const caminho = semFrag.split("?")[0];
  const alvo = resolverLocal(caminho, origem);
  if (!alvo) {
    erros.push(`${rel(origem)}: ${contexto} "${url}" -> arquivo nao existe`);
    return;
  }
  if (checarFragmento && fragmento && alvo.endsWith(".html")) {
    let frag = fragmento;
    try {
      frag = decodeURIComponent(fragmento);
    } catch {}
    if (!idsDe(alvo).has(frag)) erros.push(`${rel(origem)}: ${contexto} "${url}" -> id "${frag}" nao existe em ${rel(alvo)}`);
  }
}

function urlsCss(css) {
  const out = [];
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) out.push(m[1] ?? m[2] ?? m[3]);
  for (const m of css.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) out.push(m[1] ?? m[2]);
  return out;
}

for (const arq of arquivos) {
  const ext = path.extname(arq).toLowerCase();
  if (ext === ".html") {
    const bruto = readFileSync(arq, "utf8");
    // Sem comentarios e sem o conteudo de <script> (o atributo src da tag continua).
    const html = bruto.replace(/<!--[\s\S]*?-->/g, "").replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2");
    for (const m of html.matchAll(/\s(href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      conferir(m[2] ?? m[3] ?? m[4], arq, m[1].toLowerCase());
    }
    for (const m of html.matchAll(/\s(srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      for (const parte of decodificar(m[2] ?? m[3]).split(",")) {
        const url = parte.trim().split(/\s+/)[0];
        if (url) conferir(url, arq, m[1].toLowerCase());
      }
    }
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      for (const u of urlsCss(m[1])) conferir(u, arq, "css url()");
    }
    for (const m of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      for (const u of urlsCss(decodificar(m[1] ?? m[2]))) conferir(u, arq, "style url()");
    }
  } else if (ext === ".css") {
    for (const u of urlsCss(readFileSync(arq, "utf8"))) conferir(u, arq, "css url()");
  }
  if (dominio && [".html", ".css", ".xml", ".txt"].includes(ext)) {
    const texto = readFileSync(arq, "utf8");
    const re = new RegExp(`https?://${dominio.replace(/\./g, "\\.")}(?=[/"'\\s<>)]|$)[^"'\\s<>)]*`, "gi");
    for (const m of texto.matchAll(re)) conferir(m[0], arq, "url do dominio", false);
  }
}

if (erros.length) {
  console.error(`check-links: ${erros.length} link(s) quebrado(s):`);
  for (const e of erros) console.error("  " + e);
  process.exit(1);
}
console.log(`check-links: ok, ${conferidos} referencias internas conferidas em ${arquivos.length} arquivos.`);
