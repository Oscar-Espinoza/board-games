import type { Component } from 'svelte';
import type { GameId } from './types';
import Azul from './covers/Azul.svelte';
import Carcassonne from './covers/Carcassonne.svelte';
import Catan from './covers/Catan.svelte';
import Codenames from './covers/Codenames.svelte';
import Domino from './covers/Domino.svelte';
import LittleSecret from './covers/LittleSecret.svelte';
import SushiGoParty from './covers/SushiGoParty.svelte';
import Uno from './covers/Uno.svelte';

/** The box cover for each game. */
export const covers = {
  'little-secret': LittleSecret,
  'sushi-go-party': SushiGoParty,
  codenames: Codenames,
  domino: Domino,
  uno: Uno,
  catan: Catan,
  azul: Azul,
  carcassonne: Carcassonne,
} satisfies Record<GameId, Component>;
