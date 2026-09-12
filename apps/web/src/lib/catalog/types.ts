import type { catalog } from '@board-games/shared';
export type GameId = (typeof catalog)[number]['id'];
export type Text = () => string;
export type Lesson = {
  id: string;
  title: Text;
  explanation: Text;
  frames: [Text, Text, Text];
  scene: string;
  values: [string, string, string];
};
export type Chapter = { id: string; title: Text; lessons: Lesson[] };
export type Guide = { title: Text; chapters: Chapter[] };
