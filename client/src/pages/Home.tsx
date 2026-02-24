import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, Loader2 } from "lucide-react";
import { useItems, useCreateItem } from "@/hooks/use-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [name, setName] = useState("");
  const { data: items, isLoading, error } = useItems();
  const createItem = useCreateItem();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createItem.mutate(
      { name: name.trim() },
      {
        onSuccess: () => setName(""),
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-24 pb-12 px-6 sm:px-12 bg-[#FAFAFA] dark:bg-background">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl flex flex-col items-center text-center space-y-8"
      >
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-primary/10 rounded-2xl shadow-minimal border border-border/50 mb-4">
            <Package className="w-6 h-6 text-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
            Welcome to your Blank App
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            A beautiful, minimalist canvas ready for your next great idea. Add an item below to get started.
          </p>
        </div>

        <div className="w-full pt-8">
          <form onSubmit={handleSubmit} className="relative flex items-center w-full shadow-minimal rounded-xl overflow-hidden bg-white dark:bg-card border border-border focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all duration-300">
            <Input
              type="text"
              placeholder="What do you want to add?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-0 bg-transparent py-6 pl-6 pr-32 text-base shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
              disabled={createItem.isPending}
            />
            <div className="absolute right-2">
              <Button 
                type="submit" 
                size="sm"
                disabled={!name.trim() || createItem.isPending}
                className="rounded-lg px-4 font-medium transition-all"
              >
                {createItem.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Item
              </Button>
            </div>
          </form>
        </div>

        <div className="w-full pt-12 text-left">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Your Items
            </h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {items?.length || 0} Total
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive border border-destructive/20 bg-destructive/5 rounded-xl">
              Failed to load items. Please try again later.
            </div>
          ) : items?.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border border-dashed border-border rounded-2xl bg-white/50 dark:bg-card/50"
            >
              <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1} />
              <p className="text-muted-foreground">It's quiet here. Add your first item above.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <AnimatePresence mode="popLayout">
                {items?.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="group flex items-center justify-between p-4 bg-white dark:bg-card border border-border/60 hover:border-border rounded-xl shadow-minimal transition-all duration-300"
                  >
                    <span className="text-foreground font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">
                      ID: {item.id.toString().padStart(4, '0')}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
