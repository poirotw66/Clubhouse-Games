import type { CSSProperties } from 'react';

/** Title screen backdrop from the menu cover art. */
export function titleBackgroundStyle(): CSSProperties {
  return {
    backgroundImage: [
      'linear-gradient(rgba(10, 20, 16, 0.52), rgba(10, 20, 16, 0.94))',
      `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
    ].join(', '),
  };
}

/** Table felt with a readable overlay. */
export function feltBackgroundStyle(): CSSProperties {
  return {
    backgroundColor: '#061811',
    backgroundImage: [
      'linear-gradient(rgba(6, 24, 17, 0.72), rgba(6, 24, 17, 0.55))',
      `url(${import.meta.env.BASE_URL}felt.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
