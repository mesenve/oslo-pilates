import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);

export function createLoader(mocks = {}) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(root, path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = readFileSync(filename, "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
      const base = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(filename), name);
      const target = [base, base + ".ts", base + ".tsx", base + ".js"].find(existsSync);
      if (!target) throw new Error("Module not found: " + name);
      return load(target);
    };
    new Function("require", "module", "exports", code)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
