import { db } from "./db";
import { items, type InsertItem, type Item } from "@shared/schema";

export interface IStorage {
  getItems(): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
}

export class DatabaseStorage implements IStorage {
  async getItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }
}

export const storage = new DatabaseStorage();