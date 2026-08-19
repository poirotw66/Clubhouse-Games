import type { CSSProperties } from 'react';

/** Reuses the title hero art as a full-screen scene backdrop. */
export function sceneBackgroundStyle(): CSSProperties {
  return {
    backgroundImage: [
      'linear-gradient(rgba(7, 13, 23, 0.55), rgba(7, 13, 23, 0.92))',
      `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
    ].join(', '),
  };
}
