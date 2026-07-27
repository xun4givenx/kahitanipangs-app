import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal } from "lucide-react";

export function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-xl pt-6 -mt-6">
      <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity z-50">
        <div 
          {...attributes} 
          {...listeners} 
          className="px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground shadow-sm border border-border/50"
        >
          <GripHorizontal className="h-4 w-4" />
        </div>
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
