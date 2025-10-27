// File: apps/frontend/src/pages/dashboard/flows/[id]/components/panels/pod-library/index.tsx
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles } from 'lucide-react';
import PodLibraryItem from './pod-library-item';
import { ScrollArea } from '@/components/ui/scroll-area';

// ✅ ONLY 2 POD TYPES - Simple & Clean
const POD_TYPES = [
  {
    type: 'SOURCE',
    label: 'Source',
    icon: Upload,
    description: 'Add any input: text, document, URL, video, audio, image',
  },
  {
    type: 'LLM',
    label: 'LLM Pod',
    icon: Sparkles,
    description: 'AI processing with all options (embeddings, tools, context)',
  },
];

export default memo(function PodLibrary() {
  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="border-border/50 bg-card/30 flex h-full w-72 flex-col border-r backdrop-blur-xl"
    >
      {/* Header */}
      <div className="border-border/50 shrink-0 border-b p-4">
        <h2 className="text-sm font-semibold">Pod Library</h2>
        <p className="text-muted-foreground mt-1 text-xs">Drag pods to canvas to build your flow</p>
      </div>

      {/* Pod List - Only scrollable area */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {POD_TYPES.map((pod) => (
            <PodLibraryItem key={pod.type} {...pod} />
          ))}
        </div>
      </ScrollArea>
    </motion.div>
  );
});
