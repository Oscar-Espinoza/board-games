export type { GameId } from '@board-games/shared';
export type Text = () => string;
export type Lesson = {
  id: string;
  title: Text;
  explanation: Text;
  frames: [Text, Text, Text];
  scene: string;
  values: [string, string, string];
};
/** A term list shown above a chapter's lessons; `symbols` sets glyph terms in a narrow column. */
export type Reference = {
  title: Text;
  layout?: 'symbols';
  entries: [term: Text, description: Text][];
};
export type Chapter = {
  id: string;
  title: Text;
  lessons: Lesson[];
  reference?: Reference;
};
export type Guide = { title: Text; chapters: Chapter[] };
