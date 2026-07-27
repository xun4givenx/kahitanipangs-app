import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="absolute -left-3 lg:-left-6 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50">
        <div 
          {...attributes} 
          {...listeners} 
          className="p-1.5 rounded-md bg-secondary text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground shadow-sm border border-border"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}
