import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const POLICY_DIR = join(ROOT, "docs", "Chadchart Policy", "Policy");
const PROGRESS_DIR = join(ROOT, "docs", "Chadchart Policy", "Progress");
const OUT_DIR = join(ROOT, "data", "embedded");

const SOURCE_FILES = [
  { path: join(POLICY_DIR, "policy_city.json"), name: "policy_city", type: "policy" as const },
  { path: join(POLICY_DIR, "policy_economy.json"), name: "policy_economy", type: "policy" as const },
  { path: join(POLICY_DIR, "policy_people.json"), name: "policy_people", type: "policy" as const },
  { path: join(POLICY_DIR, "policy_system.json"), name: "policy_system", type: "policy" as const },
  { path: join(PROGRESS_DIR, "progress_city.json"), name: "progress_city", type: "progress" as const },
  { path: join(PROGRESS_DIR, "progress_economy.json"), name: "progress_economy", type: "progress" as const },
  { path: join(PROGRESS_DIR, "progress_people.json"), name: "progress_people", type: "progress" as const },
  { path: join(PROGRESS_DIR, "progress_system.json"), name: "progress_system", type: "progress" as const },
];

const DELAY_MS = 200;

function buildText(item: Record<string, unknown>, type: "policy" | "progress"): string {
  const category = String(item.category ?? "");
  const description =
    type === "policy"
      ? String(item.policy_description ?? "")
      : String(item.progress_text ?? "");
  const subcategory = item.subcategory ? `\nหมวดย่อย: ${item.subcategory}` : "";
  return `หมวดหมู่: ${category}${subcategory}\nรายละเอียด: ${description}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set in environment");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  mkdirSync(OUT_DIR, { recursive: true });

  let totalEmbedded = 0;

  for (const source of SOURCE_FILES) {
    const raw = JSON.parse(readFileSync(source.path, "utf-8")) as Record<string, unknown>[];
    console.log(`\nProcessing ${source.name} (${raw.length} items)...`);

    const output = [];

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const text = buildText(item, source.type);

      try {
        const response = await ai.models.embedContent({
          model: "gemini-embedding-001",
          contents: text,
        });

        const embedding = response.embeddings?.[0]?.values;
        if (!embedding || embedding.length === 0) {
          console.warn(`  ⚠ Empty embedding for item ${i + 1} — skipping`);
          continue;
        }

        output.push({
          ...item,
          text,
          source_file: source.name,
          embedding,
        });

        console.log(`  ✓ ${source.name} item ${i + 1}/${raw.length}`);
      } catch (err) {
        console.error(`  ✗ Error on ${source.name} item ${i + 1}:`, err);
      }

      if (i < raw.length - 1) await sleep(DELAY_MS);
    }

    const outPath = join(OUT_DIR, `${source.name}.json`);
    writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`  → Saved ${output.length} items to ${outPath}`);
    totalEmbedded += output.length;
  }

  console.log(`\nDone. Total items embedded: ${totalEmbedded}`);
}

main();
