import React from 'react';

interface AvatarImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** Face-focused crop for circular avatar frames. */
export const AvatarImage: React.FC<AvatarImageProps> = ({src, alt, className = ''}) => (
  <img
    src={src}
    alt={alt}
    draggable={false}
    className={`h-full w-full object-cover object-[center_18%] scale-[1.22] ${className}`}
  />
);
