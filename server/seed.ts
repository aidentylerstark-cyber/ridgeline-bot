import { db } from "./db";
import { items } from "@shared/schema";

async function seed() {
  const existingItems = await db.select().from(items);
  if (existingItems.length === 0) {
    console.log("Seeding database...");
    await db.insert(items).values([
      { name: "First Example Item" },
      { name: "Second Example Item" },
      { name: "Third Example Item" },
    ]);
    console.log("Database seeded successfully.");
  } else {
    console.log("Database already has items. Skipping seed.");
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed database:", err);
  process.exit(1);
});