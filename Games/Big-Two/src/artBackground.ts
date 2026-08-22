import type { CSSProperties } from 'react';

/** Title screen backdrop from the menu cover art. */
export function titleBackgroundStyle(): CSSProperties {
  return {
    backgroundImage: [
      'linear-gradient(rgba(11, 15, 31, 0.55), rgba(11, 15, 31, 0.92))',
      `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
    ].join(', '),
  };
}

/** Table felt with a readable overlay. */
export function feltBackgroundStyle(): CSSProperties {
  return {
    backgroundColor: '#0a1026',
    backgroundImage: [
      'linear-gradient(rgba(10, 16, 38, 0.72), rgba(10, 16, 38, 0.55))',
      `url(${import.meta.env.BASE_URL}felt.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
