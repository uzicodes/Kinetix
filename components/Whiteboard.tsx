'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import * as Y from 'yjs';
import { Pencil, Eraser, Undo2, Trash2, ImageDown } from 'lucide-react';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

const PALETTE = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'White', value: '#FFFFFF' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
];

// Distance between a point and a line segment
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

export function Whiteboard({ documentId }: { documentId: string }) {
  const { doc } = useWorkspace();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState<string>('#10B981');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [strokeCount, setStrokeCount] = useState<number>(0);

  const yStrokesRef = useRef<Y.Array<Stroke> | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawing = useRef<boolean>(false);

  // Redraw entire canvas with high DPI scaling
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const renderStroke = (stroke: Stroke) => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        return;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    strokesRef.current.forEach(renderStroke);
    if (currentStrokeRef.current) {
      renderStroke(currentStrokeRef.current);
    }
  }, []);

  // Handle Canvas Resizing with Device Pixel Ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      redraw();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [redraw]);

  // Bind to shared Y.Array
  useEffect(() => {
    if (!doc) return;

    const yStrokes = doc.getArray<Stroke>(`kinetix-strokes-${documentId}`);
    yStrokesRef.current = yStrokes;

    const initial = yStrokes.toArray();
    strokesRef.current = initial;
    setStrokeCount(initial.length);
    redraw();

    const observer = () => {
      const updated = yStrokes.toArray();
      strokesRef.current = updated;
      setStrokeCount(updated.length);
      redraw();
    };

    yStrokes.observe(observer);

    return () => {
      yStrokes.unobserve(observer);
    };
  }, [doc, documentId, redraw]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (activeTool === 'pen') {
      isDrawing.current = true;
      currentStrokeRef.current = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        points: [point],
        color: activeColor,
        width: strokeWidth,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      redraw();
    } else if (activeTool === 'eraser') {
      eraseStrokeAt(point);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (activeTool === 'pen' && isDrawing.current && currentStrokeRef.current) {
      currentStrokeRef.current.points.push(point);
      redraw();
    } else if (activeTool === 'eraser' && (e.buttons === 1 || e.pressure > 0)) {
      eraseStrokeAt(point);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'pen' && isDrawing.current && currentStrokeRef.current) {
      isDrawing.current = false;
      const strokeToSave = currentStrokeRef.current;
      currentStrokeRef.current = null;

      if (strokeToSave.points.length > 0 && yStrokesRef.current && doc) {
        doc.transact(() => {
          yStrokesRef.current!.push([strokeToSave]);
        });
      }
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      redraw();
    }
  };

  // Erase stroke touched by eraser point
  const eraseStrokeAt = (point: Point) => {
    if (!yStrokesRef.current || !doc) return;
    const threshold = 15;
    const currentList = strokesRef.current;

    for (let sIdx = currentList.length - 1; sIdx >= 0; sIdx--) {
      const stroke = currentList[sIdx];
      for (let pIdx = 1; pIdx < stroke.points.length; pIdx++) {
        const dist = distanceToSegment(point, stroke.points[pIdx - 1], stroke.points[pIdx]);
        if (dist <= threshold + stroke.width / 2) {
          doc.transact(() => {
            yStrokesRef.current!.delete(sIdx, 1);
          });
          return;
        }
      }
    }
  };

  const handleUndo = () => {
    if (!yStrokesRef.current || !doc) return;
    doc.transact(() => {
      const yStrokes = yStrokesRef.current!;
      if (yStrokes.length > 0) {
        yStrokes.delete(yStrokes.length - 1, 1);
      }
    });
  };

  const handleClear = () => {
    if (!yStrokesRef.current || !doc) return;
    doc.transact(() => {
      const yStrokes = yStrokesRef.current!;
      if (yStrokes.length > 0) {
        yStrokes.delete(0, yStrokes.length);
      }
    });
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create an offscreen export canvas to composite a clean dark background
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Paint clean dark background matching UI theme (#09090b / zinc-950)
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw faint grid dots matching canvas aesthetic
    ctx.fillStyle = '#27272a';
    const dpr = window.devicePixelRatio || 1;
    const dotSpacing = 24 * dpr;
    const dotRadius = 1 * dpr;
    for (let x = dotSpacing / 2; x < exportCanvas.width; x += dotSpacing) {
      for (let y = dotSpacing / 2; y < exportCanvas.height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render whiteboard strokes on top
    ctx.drawImage(canvas, 0, 0);

    // Trigger file download
    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `kinetix-whiteboard-${documentId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full h-full min-h-[70vh] select-none">
      {/* Floating Whiteboard Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl">
        {/* Tool Mode: Pen vs Eraser */}
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
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'eraser'
                ? 'bg-zinc-800 text-rose-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Eraser (Erase Strokes)"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 px-1">
          {PALETTE.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setActiveColor(c.value);
                setActiveTool('pen');
              }}
              className={`w-5 h-5 rounded-full transition-transform ${
                activeColor === c.value && activeTool === 'pen'
                  ? 'scale-125 ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900'
                  : 'hover:scale-110 opacity-80 hover:opacity-100'
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

        {/* Actions: Undo / Clear / Export PNG */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={strokeCount === 0}
            className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Undo Last Stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            disabled={strokeCount === 0}
            className="p-2 text-zinc-400 hover:text-rose-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-zinc-800 my-auto" />
          <button
            onClick={handleExportPNG}
            disabled={strokeCount === 0}
            className="px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg flex items-center gap-1 text-xs font-medium"
            title="Export Whiteboard as PNG"
          >
            <ImageDown className="w-4 h-4" />
            <span className="text-[11px] hidden sm:inline">PNG</span>
          </button>
        </div>
      </div>

      {/* HTML5 Canvas with Dot-Grid Background */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full min-h-[70vh] bg-zinc-950 rounded-2xl border border-zinc-800/80 shadow-inner ${
          activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-cell'
        }`}
        style={{
          backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
