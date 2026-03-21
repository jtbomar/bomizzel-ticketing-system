import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${isOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
    >
      {children}
    </div>
  );
};

export default DroppableColumn;
