import type { Rgb } from "./types";

const SAMPLE_SIZE = 48;

function samplePixels(data: Uint8ClampedArray): Rgb[] {
  const samples: Rgb[] = [];

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 128) continue;
    samples.push({ r, g, b });
  }

  return samples;
}

/**
 * Browser-only palette extraction from artwork URL.
 * Returns null when CORS taints the canvas or the image fails to load.
 */
export async function extractPaletteFromImageUrl(
  url: string,
): Promise<Rgb[] | null> {
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    const finish = (value: Rgb[] | null) => {
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          finish(null);
          return;
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
        const samples = samplePixels(data);
        finish(samples.length > 0 ? samples : null);
      } catch {
        finish(null);
      }
    };

    img.onerror = () => finish(null);
    img.src = url;
  });
}
