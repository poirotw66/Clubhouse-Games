import type { CSSProperties } from 'react';

/** Reuses the title hero art as a full-screen scene backdrop. */
export function sceneBackgroundStyle(): CSSProperties {
  return {
    backgroundImage: [
      'linear-gradient(rgba(6, 18, 14, 0.52), rgba(6, 18, 14, 0.94))',
      `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
    ].join(', '),
  };
}
