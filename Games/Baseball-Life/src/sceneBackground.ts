import type { CSSProperties } from 'react';
import type { Stage } from './game/types';

export type SceneTheme = Stage | 'draft' | 'title';

const THEME_IMAGES: Record<SceneTheme, string> = {
  title: 'title-bg.jpg',
  highschool: 'chapter-highschool.jpg',
  amateur: 'chapter-highschool.jpg',
  draft: 'chapter-draft.jpg',
  pro: 'chapter-pro-stadium.jpg',
  over: 'chapter-hall-of-fame.jpg',
};

/** Reuses the title hero or chapter art as a full-screen scene backdrop. */
export function sceneBackgroundStyle(theme: SceneTheme = 'title'): CSSProperties {
  const fileName = THEME_IMAGES[theme] || 'title-bg.jpg';
  return {
    backgroundImage: [
      'linear-gradient(rgba(7, 13, 23, 0.62), rgba(7, 13, 23, 0.94))',
      `url(${import.meta.env.BASE_URL}${fileName})`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  };
}
