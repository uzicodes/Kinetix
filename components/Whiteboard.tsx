'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import * as Y from 'yjs';
import {
  Pencil,
  StickyNote,
  Eraser,
  Trash2,
  Undo2,
  X,
  Palette,
} from 'lucide-react';

export interface Point {
  x: number;
  y: number;
}

export interface StrokeShape {
  id: string;
  type: 'stroke';
  points: Point[];
  color: string;
  width: number;
}

export interface NoteShape {
  id: string;
  type: 'note';
  x: number;
  y: number;
  text: string;
  color: string;
}

export type Shape = StrokeShape | NoteShape;

const COLORS = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'White', value: '#E4E4E7' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
];

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function Whiteboard({ documentId }: { documentId: string }) {
  const { doc } = useWorkspace();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeTool, setActiveTool] = useState<'pen' | 'note' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState<string>('#10B981');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);

  // In-progress stroke
  const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
  const isDrawing = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const yShapesRef = useRef<Y.Array<Shape> | null>(null);

  // Dragging sticky notes
  const [draggingNote, setDraggingNote] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Initialize and observe Y.Array
  useEffect(() => {
    if (!doc) return;

    const yShapes = doc.getArray<Shape>(`kinetix-shapes-${documentId}`);
    yShapesRef.current = yShapes;

    // Load initial shapes from CRDT
    setShapes(yShapes.toArray());

    const observer = () => {
      setShapes(yShapes.toArray());
    };

    yShapes.observe(observer);

    return () => {
      yShapes.unobserve(observer);
    };
  }, [doc, documentId]);

  // Compute coordinates relative to SVG
  const getCoordinates = (e: React.PointerEvent<SVGSVGElement>): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.target !== svgRef.current && (e.target as HTMLElement).tagName !== 'svg') {
      // If clicking inside a sticky note textarea, don't draw
      return;
    }

    const point = getCoordinates(e);

    if (activeTool === 'pen') {
      isDrawing.current = true;
      setCurrentStroke([point]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (activeTool === 'note') {
      // Create sticky note at click location
      const newNote: NoteShape = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'note',
        x: Math.max(10, point.x - 90),
        y: Math.max(10, point.y - 60),
        text: '',
        color: activeColor,
      };

      if (yShapesRef.current && doc) {
        doc.transact(() => {
          yShapesRef.current!.push([newNote]);
        });
      }
      setActiveTool('pen');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'pen' && isDrawing.current) {
      const point = getCoordinates(e);
      setCurrentStroke((prev) => (prev ? [...prev, point] : [point]));
    } else if (draggingNote && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setDraggingNote((prev) =>
        prev
          ? {
              ...prev,
              currentX: Math.max(10, Math.round(e.clientX - rect.left - prev.offsetX)),
              currentY: Math.max(10, Math.round(e.clientY - rect.top - prev.offsetY)),
            }
          : null
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'pen' && isDrawing.current && currentStroke && currentStroke.length > 0) {
      isDrawing.current = false;
      const newStroke: StrokeShape = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'stroke',
        points: currentStroke,
        color: activeColor,
        width: strokeWidth,
      };

      if (yShapesRef.current && doc) {
        doc.transact(() => {
          yShapesRef.current!.push([newStroke]);
        });
      }
      setCurrentStroke(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    // Commit dragged sticky note position
    if (draggingNote && yShapesRef.current && doc) {
      doc.transact(() => {
        const yShapes = yShapesRef.current!;
        const arr = yShapes.toArray();
        const idx = arr.findIndex((s) => s.id === draggingNote.id);
        if (idx !== -1 && arr[idx].type === 'note') {
          const note = arr[idx] as NoteShape;
          const updated: NoteShape = {
            ...note,
            x: draggingNote.currentX,
            y: draggingNote.currentY,
          };
          yShapes.delete(idx, 1);
          yShapes.insert(idx, [updated]);
        }
      });
      setDraggingNote(null);
    }
  };

  const deleteShape = (id: string) => {
    if (!yShapesRef.current || !doc) return;
    doc.transact(() => {
      const yShapes = yShapesRef.current!;
      const arr = yShapes.toArray();
      const idx = arr.findIndex((s) => s.id === id);
      if (idx !== -1) {
        yShapes.delete(idx, 1);
      }
    });
  };

  const updateNoteText = (id: string, text: string) => {
    if (!yShapesRef.current || !doc) return;
    doc.transact(() => {
      const yShapes = yShapesRef.current!;
      const arr = yShapes.toArray();
      const idx = arr.findIndex((s) => s.id === id);
      if (idx !== -1 && arr[idx].type === 'note') {
        const note = arr[idx] as NoteShape;
        const updated = { ...note, text };
        yShapes.delete(idx, 1);
        yShapes.insert(idx, [updated]);
      }
    });
  };

  const undoLastShape = () => {
    if (!yShapesRef.current || !doc) return;
    doc.transact(() => {
      const yShapes = yShapesRef.current!;
      if (yShapes.length > 0) {
        yShapes.delete(yShapes.length - 1, 1);
      }
    });
  };

  const clearCanvas = () => {
    if (!yShapesRef.current || !doc) return;
    doc.transact(() => {
      const yShapes = yShapesRef.current!;
      if (yShapes.length > 0) {
        yShapes.delete(0, yShapes.length);
      }
    });
  };

  return (
    <div className="flex flex-col w-full h-full relative select-none">
      {/* Floating Canvas Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl">
        {/* Tool selectors */}
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'pen'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Pen (Draw Freehand)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('note')}
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'note'
                ? 'bg-zinc-800 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Sticky Note (Click on canvas to place)"
          >
            <StickyNote className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'eraser'
                ? 'bg-zinc-800 text-rose-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Eraser (Click any shape or note to delete)"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 px-1">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setActiveColor(c.value)}
              className={`w-5 h-5 rounded-full transition-transform ${
                activeColor === c.value ? 'scale-125 ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Stroke Width Selector */}
        {activeTool === 'pen' && (
          <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.value}
                onClick={() => setStrokeWidth(w.value)}
                className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                  strokeWidth === w.value
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title={`${w.label} width`}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}

        {/* Canvas Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={undoLastShape}
            disabled={shapes.length === 0}
            className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={clearCanvas}
            disabled={shapes.length === 0}
            className="p-2 text-zinc-400 hover:text-rose-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Clear Whiteboard"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas with Dot-Grid Background */}
      <svg
        ref={svgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`w-full h-full min-h-[70vh] bg-zinc-950 rounded-2xl border border-zinc-800/80 shadow-inner ${
          activeTool === 'pen'
            ? 'cursor-crosshair'
            : activeTool === 'note'
            ? 'cursor-copy'
            : 'cursor-pointer'
        }`}
        style={{
          backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          touchAction: 'none',
        }}
      >
        {/* Rendered Strokes */}
        {shapes
          .filter((s): s is StrokeShape => s.type === 'stroke')
          .map((stroke) => (
            <path
              key={stroke.id}
              d={pointsToSvgPath(stroke.points)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              onClick={() => {
                if (activeTool === 'eraser') {
                  deleteShape(stroke.id);
                }
              }}
              className={activeTool === 'eraser' ? 'hover:opacity-40 cursor-pointer' : ''}
            />
          ))}

        {/* In-progress stroke */}
        {currentStroke && (
          <path
            d={pointsToSvgPath(currentStroke)}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* Rendered Sticky Notes */}
        {shapes
          .filter((s): s is NoteShape => s.type === 'note')
          .map((note) => {
            const isBeingDragged = draggingNote?.id === note.id;
            const posX = isBeingDragged ? draggingNote.currentX : note.x;
            const posY = isBeingDragged ? draggingNote.currentY : note.y;

            return (
              <foreignObject
                key={note.id}
                x={posX}
                y={posY}
                width={190}
                height={150}
                className="overflow-visible"
              >
                <div
                  className="w-[190px] h-[150px] rounded-xl shadow-xl flex flex-col p-3 border border-zinc-700/60 backdrop-blur-sm transition-shadow group relative"
                  style={{
                    backgroundColor: `${note.color}15`,
                    borderColor: `${note.color}60`,
                    boxShadow: `0 8px 24px -4px ${note.color}25`,
                  }}
                >
                  {/* Drag Handle & Delete Header */}
                  <div
                    onPointerDown={(e) => {
                      if (activeTool === 'eraser') {
                        deleteShape(note.id);
                        return;
                      }
                      if (svgRef.current) {
                        const rect = svgRef.current.getBoundingClientRect();
                        setDraggingNote({
                          id: note.id,
                          offsetX: e.clientX - rect.left - posX,
                          offsetY: e.clientY - rect.top - posY,
                          currentX: posX,
                          currentY: posY,
                        });
                      }
                    }}
                    className="flex items-center justify-between pb-1.5 cursor-grab active:cursor-grabbing border-b border-zinc-700/40"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: note.color }}
                    />
                    <button
                      onClick={() => deleteShape(note.id)}
                      className="text-zinc-400 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                      title="Delete note"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Note Body */}
                  <textarea
                    defaultValue={note.text}
                    onBlur={(e) => updateNoteText(note.id, e.target.value)}
                    placeholder="Type a quick note..."
                    className="w-full flex-1 mt-2 bg-transparent resize-none focus:outline-none text-xs text-zinc-100 placeholder:text-zinc-500 font-sans leading-relaxed"
                  />
                </div>
              </foreignObject>
            );
          })}
      </svg>
    </div>
  );
}

