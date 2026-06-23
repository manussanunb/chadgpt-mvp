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

const DELAY_MS = 1000;

function buildText(item: Record<string, unknown>, type: "policy" | "progress"): string {
  const category = String(item.category ?? "");
  const description =
    type === "policy"
      ? String(item.policy_description ?? "")
      : String(item.progress_text ?? "");
  const subcategory = item.subcategory ? `\nหมวดย่อย: ${item.subcategory}` : "";
  
  if (type === "policy") {
    const name = String(item.policy_name ?? "");
    return `หมวดหมู่: ${category}${subcategory}\nชื่อนโยบาย: ${name}\nรายละเอียด: ${description}`;
  }
  
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

  const CATEGORY_GROUPS = [
    { group: "สุขภาพ", categories: ["การส่งเสริมสุขภาพและป้องกันโรค", "การดูแลและรักษาผู้ป่วย", "สุขภาพจิต", "ยาเสพติด"], source_url: "https://teamchadchart.com/people" },
    { group: "คุณภาพชีวิต", categories: ["ที่อยู่อาศัย", "ชุมชนและสวัสดิการ", "ผู้สูงอายุ", "คนไร้บ้าน", "คนพิการ", "เด็กเล็กและครอบครัว", "ความหลากหลายทางเพศ"], source_url: "https://teamchadchart.com/people" },
    { group: "การศึกษาและการเรียนรู้", categories: ["เด็กมีความสุข", "เด็กมีทักษะ", "ครู", "ผู้ปกครอง", "เด็กหลุด"], source_url: "https://teamchadchart.com/people" },
    { group: "การเดินทาง", categories: ["การจราจรและความปลอดภัยบนท้องถนน", "ระบบขนส่งสาธารณะ", "การเดิน การปั่น และการเข้าถึงระบบขนส่ง", "ผังเมือง"], source_url: "https://teamchadchart.com/city" },
    { group: "การจัดการมลภาวะ", categories: ["อากาศสะอาด", "เมืองคาร์บอนต่ำ", "ขยะ", "น้ำเสีย"], source_url: "https://teamchadchart.com/city" },
    { group: "พื้นที่สีเขียว และพื้นที่สาธารณะ", categories: ["พื้นที่สีเขียวและความหลากหลายทางชีวภาพ", "พื้นที่เรียนรู้และสร้างสรรค์", "พื้นที่ออกกำลังกายและกีฬา", "สัตว์เลี้ยง สัตว์จร"], source_url: "https://teamchadchart.com/city" },
    { group: "สาธารณภัยและภัยพิบัติ", categories: ["สาธารณภัย", "น้ำท่วม", "ความปลอดภัย", "Urban Heat"], source_url: "https://teamchadchart.com/city" },
    { group: "ทักษะแรงงานและเศรษฐกิจ", categories: ["พัฒนาทักษะ", "ส่งเสริมผู้ประกอบการรายย่อย", "เศรษฐกิจเมือง"], source_url: "https://teamchadchart.com/economy" },
    { group: "งานบริการและความโปร่งใส", categories: ["การขออนุญาตและการบริการประชาชน", "การเปิดเผยข้อมูล และตรวจสอบการกระทำผิด"], source_url: "https://teamchadchart.com/economy" },
    { group: "การบริหารจัดการเมือง", categories: ["ระบบปฏิบัติการเมือง", "การมีส่วนร่วมของประชาชน"], source_url: "https://teamchadchart.com/system" }
  ];



  console.log("\nProcessing Category Groups...");
  const groupsOutput = [];
  for (const cg of CATEGORY_GROUPS) {
    const contextText = `กลุ่มหมวดหมู่นโยบาย: ${cg.group}\nหมวดหมู่ย่อยที่อยู่ภายใต้กลุ่มนี้ประกอบด้วย:\n${cg.categories.map(c => `- ${c}`).join("\n")}`;
    
    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents:  `นโยบาย${cg.group}`,
      });

      const embedding = response.embeddings?.[0]?.values;
      if (!embedding || embedding.length === 0) continue;

      groupsOutput.push({
        category: cg.group,
        source_url: cg.source_url,
        text: contextText,
        source_file: "policy_groups",
        embedding,
        is_overview: true,
      });
      console.log(`  ✓ Embedded group: ${cg.group}`);
    } catch (err) {
      console.error(`  ✗ Error embedding group ${cg.group}:`, err);
    }
    await sleep(DELAY_MS);
  }
  
  if (groupsOutput.length > 0) {
    const outPath = join(OUT_DIR, `policy_groups.json`);
    writeFileSync(outPath, JSON.stringify(groupsOutput, null, 2));
    console.log(`  → Saved ${groupsOutput.length} items to ${outPath}`);
    totalEmbedded += groupsOutput.length;
  }
  const categoryOutput = [];
  for (const source of SOURCE_FILES) {
    const raw = JSON.parse(readFileSync(source.path, "utf-8")) as Record<string, unknown>[];
    console.log(`\nProcessing ${source.name} (${raw.length} items)...`);

  //   const output = [];
    
    if (source.type === "policy") {
      const categoryMap = new Map<string, { description: string; url: string; subcategories: Map<string, string[]> }>();
      for (const item of raw) {
        const cat = String(item.category ?? "");
        const catDesc = String(item.category_description ?? "");
        const subcat = item.subcategory ? String(item.subcategory) : "อื่นๆ";
        const name = String(item.policy_name ?? "");
        const url = String(item.source_url ?? "");

        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { description: catDesc, url, subcategories: new Map() });
        }
        
        const catData = categoryMap.get(cat)!;
        if (!catData.subcategories.has(subcat)) {
          catData.subcategories.set(subcat, []);
        }
        
        if (name) {
          catData.subcategories.get(subcat)!.push(name);
        }
      }

      let catIndex = 1;
      for (const [cat, data] of categoryMap.entries()) {
        let groupedPoliciesText = "";
        let subcatsOnlyText = "";
        for (const [subcat, policies] of data.subcategories.entries()) {
          groupedPoliciesText += `\n[หมวดย่อย: ${subcat}]\n`;
          groupedPoliciesText += policies.map(p => `- ${p}`).join("\n") + "\n";
          subcatsOnlyText += `- ${subcat}\n`;
        }
        
        const contextText = `หมวดหมู่: ${cat}\nรายละเอียดภาพรวม: ${data.description}\nหมวดย่อยที่มีในหมวดหมู่นี้:\n${subcatsOnlyText.trim()}`;

        try {
          const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: contextText,
          });

          const embedding = response.embeddings?.[0]?.values;
          if (!embedding || embedding.length === 0) {
            console.warn(`  ⚠ Empty embedding for category ${cat} — skipping`);
            continue;
          }

          categoryOutput.push({
            category: cat,
            source_url: data.url,
            text: contextText,
            source_file: source.name,
            embedding,
            is_overview: true,
          });

          console.log(`  ✓ ${source.name} category overview ${catIndex}/${categoryMap.size}`);
        } catch (err) {
          console.error(`  ✗ Error on ${source.name} category ${cat}:`, err);
        }
        catIndex++;
        await sleep(DELAY_MS);
      }
    }

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

  const categoryOutPath = join(OUT_DIR, `category.json`);
  writeFileSync(categoryOutPath, JSON.stringify(categoryOutput, null, 2));
  console.log(`  → Saved ${categoryOutput.length} items to ${categoryOutPath}`);
  totalEmbedded += categoryOutput.length;
  console.log(`\nDone. Total items embedded: ${totalEmbedded}`);
}

main();
