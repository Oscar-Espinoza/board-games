import type { Component } from 'svelte';
import type { GameId } from './types';
import Azul from './steps/Azul.svelte';
import Carcassonne from './steps/Carcassonne.svelte';
import Catan from './steps/Catan.svelte';
import Codenames from './steps/Codenames.svelte';
import Domino from './steps/Domino.svelte';
import LittleSecret from './steps/LittleSecret.svelte';
import SushiGoParty from './steps/SushiGoParty.svelte';
import Uno from './steps/Uno.svelte';

/** The summary-loop pictogram for each game. */
export const steps = {
  'little-secret': LittleSecret,
  'sushi-go-party': SushiGoParty,
  codenames: Codenames,
  domino: Domino,
  uno: Uno,
  catan: Catan,
  azul: Azul,
  carcassonne: Carcassonne,
} satisfies Record<GameId, Component<{ step: number }>>;
