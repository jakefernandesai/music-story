import Image from "next/image";
import { isValidImageUrl } from "@/lib/artwork";

type ArtworkImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
  fill?: boolean;
};

export function ArtworkImage({
  src,
  alt,
  className = "object-cover",
  sizes,
  priority = false,
  fill = true,
}: ArtworkImageProps) {
  if (!isValidImageUrl(src)) {
    return (
      <div
        className={`${fill ? "absolute inset-0" : ""} bg-gradient-to-br from-surface-elevated via-accent/10 to-surface ${className}`}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
