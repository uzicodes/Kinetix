'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import * as Y from 'yjs';
import { MousePointer2, Pencil, Eraser, Undo2, Trash2, Download, ImageUp } from 'lucide-react';

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

export interface BoardImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolMode = 'draw' | 'select' | 'erase';

const PALETTE = [
  { label: 'Emerald', value: '#10B981' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'White', value: '#FFFFFF' },
];

const THICKNESS_PRESETS = [2, 4, 8, 14];

// Distance between a point and a line segment
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

// Optimized Line-to-Circle Hit Detection with Bounding Box Pre-Check
function strokeIntersectsCircle(stroke: Stroke, center: Point, radius: number): boolean {
  if (stroke.points.length === 0) return false;

  const effectiveRadius = radius + stroke.width / 2;

  // 1. Quick Bounding Box Pre-Check for 60fps performance
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  if (
    center.x + effectiveRadius < minX ||
    center.x - effectiveRadius > maxX ||
    center.y + effectiveRadius < minY ||
    center.y - effectiveRadius > maxY
  ) {
    return false;
  }

  // 2. Single-point stroke check
  if (stroke.points.length === 1) {
    return Math.hypot(center.x - stroke.points[0].x, center.y - stroke.points[0].y) <= effectiveRadius;
  }

  // 3. Exact Segment-to-Circle distance check
  for (let i = 1; i < stroke.points.length; i++) {
    if (distanceToSegment(center, stroke.points[i - 1], stroke.points[i]) <= effectiveRadius) {
      return true;
    }
  }

  return false;
}

export function Whiteboard({ documentId }: { documentId: string }) {
  const { doc } = useWorkspace();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Tool Modes: 'draw' | 'select' | 'erase'
  const [toolMode, setToolMode] = useState<ToolMode>('draw');
  const [activeColor, setActiveColor] = useState<string>('#10B981');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [eraserRadius, setEraserRadius] = useState<number>(20);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [imageCount, setImageCount] = useState<number>(0);

  // Selection & drag state for images
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const dragInfoRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // 2. Visual Eraser Cursor position
  const eraserPosRef = useRef<Point | null>(null);

  const isCustomColor = !PALETTE.some((c) => c.value.toLowerCase() === activeColor.toLowerCase());

  const yStrokesRef = useRef<Y.Array<Stroke> | null>(null);
  const yImagesRef = useRef<Y.Map<BoardImage> | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const imagesRef = useRef<BoardImage[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isPointerDown = useRef<boolean>(false);

  // In-memory image cache to eliminate re-rendering flicker
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

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

    // 1. Render uploaded images FIRST (so strokes can be drawn over them)
    imagesRef.current.forEach((item) => {
      let cachedImg = imageCacheRef.current.get(item.id);
      if (!cachedImg) {
        cachedImg = new Image();
        cachedImg.src = item.dataUrl;
        cachedImg.onload = () => {
          imageCacheRef.current.set(item.id, cachedImg!);
          redraw();
        };
        imageCacheRef.current.set(item.id, cachedImg);
      } else if (cachedImg.complete && cachedImg.naturalWidth > 0) {
        ctx.drawImage(cachedImg, item.x, item.y, item.width, item.height);

        // Visual feedback: selection / hover bounding box in 'select' mode
        const isSelected = item.id === selectedImageId;
        const isHovered = item.id === hoveredImageId && toolMode === 'select';

        if (isSelected || isHovered) {
          ctx.save();
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#38bdf880';
          ctx.lineWidth = 2;
          ctx.setLineDash(isSelected ? [6, 4] : [4, 4]);
          ctx.strokeRect(item.x - 2, item.y - 2, item.width + 4, item.height + 4);

          if (isSelected) {
            ctx.fillStyle = '#38bdf8';
            ctx.setLineDash([]);
            const handleSize = 6;
            const corners = [
              [item.x - 2, item.y - 2],
              [item.x + item.width + 2, item.y - 2],
              [item.x - 2, item.y + item.height + 2],
              [item.x + item.width + 2, item.y + item.height + 2],
            ];
            corners.forEach(([cx, cy]) => {
              ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
            });
          }
          ctx.restore();
        }
      }
    });

    // 2. Render freehand strokes on top of images
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

    // 3. Render Visual Eraser Brush (hollow translucent circle) in 'erase' mode
    if (toolMode === 'erase' && eraserPosRef.current) {
      const { x, y } = eraserPosRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, eraserRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.12)'; // faint rose fill
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)'; // crisp rose outline
      ctx.stroke();
      ctx.restore();
    }
  }, [selectedImageId, hoveredImageId, toolMode, eraserRadius]);

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

  // Bind to shared Y.Array for Strokes & Y.Map for Images
  useEffect(() => {
    if (!doc) return;

    // --- Strokes CRDT Array ---
    const yStrokes = doc.getArray<Stroke>(`kinetix-strokes-${documentId}`);
    yStrokesRef.current = yStrokes;
    const initialStrokes = yStrokes.toArray();
    strokesRef.current = initialStrokes;
    setStrokeCount(initialStrokes.length);

    const strokesObserver = () => {
      const updated = yStrokes.toArray();
      strokesRef.current = updated;
      setStrokeCount(updated.length);
      redraw();
    };
    yStrokes.observe(strokesObserver);

    // --- Images CRDT Map ---
    const yImages = doc.getMap<BoardImage>(`kinetix-images-${documentId}`);
    yImagesRef.current = yImages;

    const syncImages = () => {
      const currentList: BoardImage[] = [];
      yImages.forEach((val) => {
        currentList.push(val);
      });
      imagesRef.current = currentList;
      setImageCount(currentList.length);
      redraw();
    };

    syncImages();

    const imagesObserver = () => {
      syncImages();
    };
    yImages.observe(imagesObserver);

    redraw();

    return () => {
      yStrokes.unobserve(strokesObserver);
      yImages.unobserve(imagesObserver);
    };
  }, [doc, documentId, redraw]);

  // Keyboard shortcut: Delete or Backspace removes the currently selected image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId && yImagesRef.current && doc) {
        e.preventDefault();
        const idToDelete = selectedImageId;
        setSelectedImageId(null);
        doc.transact(() => {
          yImagesRef.current!.delete(idToDelete);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, selectedImageId]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // 4. Spatial Stroke Eraser: deletes entire paths that intersect with eraser circle
  const eraseStrokesAt = (point: Point) => {
    if (!yStrokesRef.current || !doc) return;
    const currentList = strokesRef.current;
    const indicesToDelete: number[] = [];

    // Check all strokes from top to bottom
    for (let i = currentList.length - 1; i >= 0; i--) {
      if (strokeIntersectsCircle(currentList[i], point, eraserRadius)) {
        indicesToDelete.push(i);
      }
    }

    if (indicesToDelete.length > 0) {
      doc.transact(() => {
        // Delete descending so indices remain valid
        for (const idx of indicesToDelete) {
          yStrokesRef.current!.delete(idx, 1);
        }
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    isPointerDown.current = true;

    if (toolMode === 'select') {
      const images = imagesRef.current;
      let hitImage: BoardImage | null = null;
      for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (
          point.x >= img.x &&
          point.x <= img.x + img.width &&
          point.y >= img.y &&
          point.y <= img.y + img.height
        ) {
          hitImage = img;
          break;
        }
      }

      if (hitImage) {
        setSelectedImageId(hitImage.id);
        dragInfoRef.current = {
          id: hitImage.id,
          offsetX: point.x - hitImage.x,
          offsetY: point.y - hitImage.y,
          currentX: hitImage.x,
          currentY: hitImage.y,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        setSelectedImageId(null);
        dragInfoRef.current = null;
      }
      redraw();
    } else if (toolMode === 'draw') {
      currentStrokeRef.current = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        points: [point],
        color: activeColor,
        width: strokeWidth,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      redraw();
    } else if (toolMode === 'erase') {
      eraserPosRef.current = point;
      eraseStrokesAt(point);
      redraw();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (toolMode === 'select') {
      if (dragInfoRef.current) {
        const newX = Math.round(point.x - dragInfoRef.current.offsetX);
        const newY = Math.round(point.y - dragInfoRef.current.offsetY);
        dragInfoRef.current.currentX = newX;
        dragInfoRef.current.currentY = newY;

        const targetId = dragInfoRef.current.id;
        const imgIndex = imagesRef.current.findIndex((img) => img.id === targetId);
        if (imgIndex !== -1) {
          imagesRef.current[imgIndex] = {
            ...imagesRef.current[imgIndex],
            x: newX,
            y: newY,
          };
        }
        redraw();
      } else {
        const images = imagesRef.current;
        let hit = false;
        for (let i = images.length - 1; i >= 0; i--) {
          const img = images[i];
          if (
            point.x >= img.x &&
            point.x <= img.x + img.width &&
            point.y >= img.y &&
            point.y <= img.y + img.height
          ) {
            hit = true;
            if (hoveredImageId !== img.id) {
              setHoveredImageId(img.id);
              redraw();
            }
            break;
          }
        }
        if (!hit && hoveredImageId !== null) {
          setHoveredImageId(null);
          redraw();
        }
      }
    } else if (toolMode === 'draw' && isPointerDown.current && currentStrokeRef.current) {
      currentStrokeRef.current.points.push(point);
      redraw();
    } else if (toolMode === 'erase') {
      eraserPosRef.current = point;
      if (isPointerDown.current || e.buttons === 1 || e.pressure > 0) {
        eraseStrokesAt(point);
      }
      redraw();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDown.current = false;

    if (toolMode === 'select' && dragInfoRef.current) {
      const { id, currentX, currentY } = dragInfoRef.current;
      dragInfoRef.current = null;

      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (doc && yImagesRef.current) {
        const existing = yImagesRef.current.get(id);
        if (existing && (existing.x !== currentX || existing.y !== currentY)) {
          doc.transact(() => {
            yImagesRef.current!.set(id, {
              ...existing,
              x: currentX,
              y: currentY,
            });
          });
        }
      }
      redraw();
    } else if (toolMode === 'draw' && currentStrokeRef.current) {
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

  const handlePointerLeave = () => {
    isPointerDown.current = false;
    if (toolMode === 'erase') {
      eraserPosRef.current = null;
      redraw();
    }
  };

  // Image Upload Handler with offscreen compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc || !yImagesRef.current) return;

    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > maxDim || targetHeight > maxDim) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
            targetHeight = maxDim;
          }
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;

        offCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const compressedDataUrl = offscreen.toDataURL(
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.85
        );

        const displayMaxWidth = 360;
        let displayWidth = targetWidth;
        let displayHeight = targetHeight;
        if (displayWidth > displayMaxWidth) {
          displayHeight = Math.round((displayHeight * displayMaxWidth) / displayWidth);
          displayWidth = displayMaxWidth;
        }

        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const cWidth = canvas ? canvas.width / dpr : 600;
        const cHeight = canvas ? canvas.height / dpr : 500;
        const posX = Math.max(20, Math.round((cWidth - displayWidth) / 2));
        const posY = Math.max(60, Math.round((cHeight - displayHeight) / 2));

        const boardImage: BoardImage = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          dataUrl: compressedDataUrl,
          x: posX,
          y: posY,
          width: displayWidth,
          height: displayHeight,
        };

        imageCacheRef.current.set(boardImage.id, img);

        doc.transact(() => {
          yImagesRef.current!.set(boardImage.id, boardImage);
        });

        setSelectedImageId(boardImage.id);
        setToolMode('select');
        redraw();
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleUndo = () => {
    if (!doc) return;
    doc.transact(() => {
      if (yStrokesRef.current && yStrokesRef.current.length > 0) {
        yStrokesRef.current.delete(yStrokesRef.current.length - 1, 1);
      } else if (yImagesRef.current && yImagesRef.current.size > 0) {
        const keys = Array.from(yImagesRef.current.keys());
        const lastKey = keys[keys.length - 1];
        if (lastKey) {
          yImagesRef.current.delete(lastKey);
          if (selectedImageId === lastKey) {
            setSelectedImageId(null);
          }
        }
      }
    });
  };

  const handleClear = () => {
    if (!doc) return;
    doc.transact(() => {
      if (yStrokesRef.current && yStrokesRef.current.length > 0) {
        yStrokesRef.current.delete(0, yStrokesRef.current.length);
      }
      if (yImagesRef.current) {
        for (const key of Array.from(yImagesRef.current.keys())) {
          yImagesRef.current.delete(key);
        }
        setSelectedImageId(null);
      }
    });
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Temporarily hide eraser circle for clean image export
    const prevEraserPos = eraserPosRef.current;
    eraserPosRef.current = null;
    redraw();

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

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

    // Render composite (images + strokes) on top
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `kinetix-whiteboard-${documentId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Restore eraser position
    eraserPosRef.current = prevEraserPos;
    redraw();
  };

  const hasContent = strokeCount > 0 || imageCount > 0;

  // 2. Dynamic canvas cursor: hide native cursor when using custom visual circular eraser
  const getCanvasCursor = () => {
    if (toolMode === 'erase') return 'cursor-none';
    if (toolMode === 'select') {
      if (dragInfoRef.current) return 'cursor-grabbing';
      if (hoveredImageId) return 'cursor-grab';
      return 'cursor-default';
    }
    if (toolMode === 'draw') return 'cursor-crosshair';
    return 'cursor-default';
  };

  return (
    <div ref={containerRef} className="relative flex flex-col w-full h-full min-h-[70vh] select-none">
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Floating Whiteboard Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-nowrap items-center gap-1.5 sm:gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl max-w-[96vw] overflow-x-auto">
        {/* Tool Mode: Select vs Draw vs Erase */}
        <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/80 shrink-0">
          <button
            onClick={() => {
              setToolMode('select');
              eraserPosRef.current = null;
              redraw();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              toolMode === 'select'
                ? 'bg-zinc-800 text-sky-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Select & Move Images"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setToolMode('draw');
              setSelectedImageId(null);
              eraserPosRef.current = null;
              redraw();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              toolMode === 'draw'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Pen (Draw Freehand)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setToolMode('erase');
              setSelectedImageId(null);
              redraw();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              toolMode === 'erase'
                ? 'bg-zinc-800 text-rose-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Stroke Eraser (Spatial Brush)"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Color Palette (Active during Draw mode) */}
        <div className="flex items-center gap-1 px-0.5 shrink-0">
          {PALETTE.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setActiveColor(c.value);
                setToolMode('draw');
              }}
              className={`w-4 h-4 rounded-full transition-transform ${
                activeColor.toLowerCase() === c.value.toLowerCase() && toolMode === 'draw'
                  ? 'scale-125 ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900'
                  : 'hover:scale-110 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}

          {/* Custom Color Selection Widget */}
          <label
            className={`relative w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-transform shrink-0 overflow-hidden ${
              isCustomColor && toolMode === 'draw'
                ? 'scale-125 ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900'
                : 'hover:scale-110 opacity-80 hover:opacity-100'
            }`}
            style={{
              background: isCustomColor
                ? activeColor
                : 'conic-gradient(from 90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00ffff, #0000ff, #8b00ff, #ff0000)',
            }}
            title={isCustomColor ? `Custom Color: ${activeColor}` : 'Custom Color Picker'}
          >
            <input
              type="color"
              value={activeColor}
              onChange={(e) => {
                setActiveColor(e.target.value);
                setToolMode('draw');
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
            />
          </label>
        </div>

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Dynamic Size Control: Pen Thickness vs Eraser Radius */}
        {toolMode === 'draw' && (
          <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2 py-1 rounded-xl border border-zinc-800/80 shrink-0">
            <div className="flex items-center gap-0.5">
              {THICKNESS_PRESETS.map((size) => (
                <button
                  key={size}
                  onClick={() => setStrokeWidth(size)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    strokeWidth === size
                      ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700 shadow-sm'
                      : 'hover:bg-zinc-900 text-zinc-500'
                  }`}
                  title={`Thickness: ${size}px`}
                >
                  <span
                    className="rounded-full transition-transform"
                    style={{
                      width: `${Math.min(12, Math.max(3, size))}px`,
                      height: `${Math.min(12, Math.max(3, size))}px`,
                      backgroundColor: strokeWidth === size ? activeColor : '#71717a',
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-zinc-800" />

            <div className="flex items-center gap-1">
              <input
                type="range"
                min="1"
                max="24"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-14 sm:w-16 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                title={`Brush thickness: ${strokeWidth}px`}
              />
              <span className="text-[10px] font-mono text-zinc-400 w-5 text-right">
                {strokeWidth}p
              </span>
            </div>
          </div>
        )}

        {toolMode === 'erase' && (
          <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2 py-1 rounded-xl border border-zinc-800/80 shrink-0">
            <div className="flex items-center gap-0.5">
              {[12, 20, 32].map((r) => (
                <button
                  key={r}
                  onClick={() => setEraserRadius(r)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    eraserRadius === r
                      ? 'bg-zinc-800 text-rose-400 font-semibold ring-1 ring-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={`Eraser radius: ${r}px`}
                >
                  {r * 2}p
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-zinc-800" />

            <div className="flex items-center gap-1">
              <input
                type="range"
                min="8"
                max="48"
                value={eraserRadius}
                onChange={(e) => setEraserRadius(Number(e.target.value))}
                className="w-14 sm:w-16 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400"
                title={`Eraser diameter: ${eraserRadius * 2}px`}
              />
              <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">
                {eraserRadius * 2}p
              </span>
            </div>
          </div>
        )}

        <div className="h-5 w-px bg-zinc-800 shrink-0" />

        {/* Actions: Undo / Clear / Divider / Upload Image / Save (Download) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleUndo}
            disabled={!hasContent}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            disabled={!hasContent}
            className="p-1.5 text-zinc-400 hover:text-rose-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-zinc-800 my-auto mx-0.5" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-zinc-400 hover:text-emerald-400 transition-colors rounded-lg"
            title="Upload Image (PNG, JPG)"
          >
            <ImageUp className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPNG}
            disabled={!hasContent}
            className="p-1.5 text-zinc-400 hover:text-emerald-400 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors rounded-lg"
            title="Download / Save Board as PNG"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* HTML5 Canvas with Dynamic Eraser Brush & Dot-Grid Background */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={`w-full h-full min-h-[70vh] bg-zinc-950 rounded-2xl border border-zinc-800/80 shadow-inner ${getCanvasCursor()}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          touchAction: 'none',
        }}
      />
    </div>
  );
}