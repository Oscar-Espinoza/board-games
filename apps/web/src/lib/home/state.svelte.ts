export type Panel = 'start' | 'summary' | 'rules' | 'join';

/** The layout's join button asks the home page to open its join dialog. */
export const joinRequest = $state({ pending: false });
