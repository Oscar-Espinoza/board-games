# Sushi Go Party!

The catalog implements the complete standard Party! box for 2–8 players. It does
not include promotional cards, Sushi Roll, bots in multiplayer rooms, accounts,
or persistent game storage. Rules are authoritative Bun/TypeScript; the Svelte
board receives separate public and recipient-private projections.

## Playing

The room host starts a whole three-round match. All seats then agree on a menu.
Any connected seat can propose one of eight presets or a legal custom selection;
every proposal clears readiness. The last ready seat deals only while all seats
are connected. Choose a dish, optionally declare saved utensils, and explicitly
keep it. Every commitment remains private until the whole table reveals.

The hand passes left after special effects finish. Numbered effects use saved,
actor-owned prompts. Round receipts show each scoring group, points added at round
end, and Uramaki points that were already awarded. After round three, dessert
scoring determines the result. The room host can start another feast.

The illustrated book opens searchable dish rules and advanced conventions. The
catalog library adds 26 authored, accessible lessons with distinct before/action/
result diagrams and numerical examples in English and Spanish. The
gear contains sound, volume, motion and supplied room controls. Sounds start only
after a user gesture and never block actions. Only presentation preferences and
the existing room reconnect credential are stored in the browser. Missing seats
pause choices while preserving commitments and prompts. Cosmetic events cancel on
hiding, reconnection, snapshot gaps, resize and preference changes; returning to
the table renders the latest state without replaying older events.

## Edition evidence and inventory

The [Gamewright rulebook](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf)
is the rules baseline. The original plan and the bounded photographic inventory
pass are retained in [the plan](sushi-go-party-plan.md) and
[implementation handoff](../handoffs/sushi-go-party.md). Card art here is original
SVG; no publisher or seller card images ship in the application.

| Family                        | Physical cards                                                      |
| ----------------------------- | ------------------------------------------------------------------- |
| Nigiri                        | Egg 4, salmon 5, squid 3                                            |
| Maki                          | 1 icon ×4, 2 icons ×5, 3 icons ×3                                   |
| Temaki                        | 12                                                                  |
| Uramaki                       | 3, 4 and 5 icons ×4 each                                            |
| Appetizers                    | 8 each; Onigiri has circle/triangle/square/rectangle ×2             |
| Specials                      | 3 each; Chopsticks 1/2/3, Spoon 4/5/6, Menu 7/8/9, Takeout 10/11/12 |
| Pudding / green tea ice cream | 15 each                                                             |
| Fruit                         | Each mixed pair ×3; each double fruit ×2                            |
| **Total**                     | **181**, excluding menu tiles                                       |

Nigiri and Wasabi share one semantic scoring-color group. Every other type has a
separate group; variants share their type's group. Copies freeze the source's
effective identity, icons, shape and priority. Scoring never reads CSS colors.

Each menu includes 12 Nigiri, 12 rolls, 24 appetizers and 6 specials: 54 non-dessert
cards. Desserts join the deck in groups 5/3/2 for 2–5 seats and 7/5/3 for 6–8.
Hands have 10 cards at 2–3 seats, 9 at 4–5, 8 at 6–7, and 7 at eight seats.
Physical cards move between explicit zones; the engine never regenerates a deck
between rounds. Unboxed played desserts, including Special Order copies, stay out.

| Preset          | Roll    | Appetizers                 | Specials            | Dessert             |
| --------------- | ------- | -------------------------- | ------------------- | ------------------- |
| My First Meal   | Maki    | Tempura, Sashimi, Miso     | Wasabi, Tea         | Green tea ice cream |
| Sushi Go!       | Maki    | Tempura, Sashimi, Dumpling | Chopsticks, Wasabi  | Pudding             |
| Party Sampler   | Temaki  | Tempura, Dumpling, Tofu    | Wasabi, Menu        | Green tea ice cream |
| Master Menu     | Temaki  | Onigiri, Tofu, Sashimi     | Spoon, Takeout      | Fruit               |
| Points Platter  | Uramaki | Onigiri, Dumpling, Edamame | Special Order, Tea  | Green tea ice cream |
| Cutthroat Combo | Temaki  | Eel, Tofu, Miso            | Spoon, Soy Sauce    | Pudding             |
| Big Banquet     | Maki    | Tempura, Dumpling, Eel     | Spoon, Chopsticks   | Green tea ice cream |
| Dinner for Two  | Uramaki | Onigiri, Tofu, Miso        | Menu, Special Order | Fruit               |

Menu and Special Order are unavailable with 7–8 players. Spoon and Edamame are
unavailable with two. Recommendations in preset titles do not add capacity bans.

## Advanced behavior and disclosed conventions

Primary Miso and Uramaki resolve as a simultaneous batch; socket arrival order
cannot settle a tied race. Miso's ledger lasts the entire draft turn, so a third
soup cannot escape after two earlier soups collide. Extra cards are played at
their legal resolution point. Newly played utensils wait until a later turn.
Menu saves exactly four private offer cards; it excludes another Menu from its
selectable options, returns unused cards and shuffles once after acceptance.
Spoon finds the first supplier to the left. That supplier chooses only when there
are genuinely distinct matching appearances, including numbered variations.

The following named app conventions cover edge clarifications that could not be
verified from accessible publisher/designer material. They appear in the guide.

- **C1:** A copied utensil immediately becomes its physical Special Order again
  when returned to a hand. No new physical card is created.
- **C2:** A seat can declare several distinct eligible utensils. Resolve equal
  priorities by fixed canonical seat, then public acquisition order. Never use
  request timing. Each declared card activates at most once that turn.
- **C3:** Nigiri and Wasabi may be boxed independently. Either breaks their link;
  unboxed Wasabi becomes available to a later Nigiri. Existing Nigiri does not
  retroactively attach elsewhere.
- **C4:** Equal Temaki/Pudding counts receive both awards at 3+ seats, netting
  zero; at two seats both receive the positive award, including all-zero counts.
  All-zero residual Uramaki awards nothing. Positive residual ties receive the
  full next unclaimed award.
- **C5:** Tea counts only desserts played in the current round.
- **C6:** Boxed cards have no scoring color or dessert status and score two each.
  A copied boxed card is also boxed and worth two.
- **C7:** Equal final points and equal dessert counts produce shared winners.

A copied unattached Nigiri may attach to an available Wasabi through a separate
optional attachment prompt. Copying an attached Nigiri does not copy its Wasabi
link or permit a new attachment. A copy survives later changes to its source.

## Protocol and privacy

`PICK {round, turn, promptId, card, copyTarget?, utensils}` locks a private hand
handle and optional frozen copy. `utensils` is always present. `READY {round,
version}` uses the setup/readiness version. `SET_MENU {version, menu}` is setup
only. `RESOLVE {round, turn, promptId, choice}` belongs to the prompt actor.
Choices are discriminated card, request, takeout, copy or attach records.

Private hand handles rotate on passing and ownership exchanges. Public dish IDs
are unrelated to physical IDs. Reconnection reproduces the saved hand, commitment
and offer. Public prompt metadata contains only ID, actor and kind. Only the
prompt's actor sees offer/matching cards and legal targets. Canonical state is
never spread into a view. Accepted presentation events explicitly project their
public fields, and commitment events contain only the seat.

Shared room revisions, match epochs, authentication and action-ID deduplication
remain in force. Only guarded PICK and READY retries are automatic; other choices
must be reviewed after a stale response. The shared retry implementation belongs
to the coordinator. In-game round numbers are distinct from `RoomView.round`,
which identifies the whole match.

## Practice and validation

[`/practice/sushi-go-party`](/practice/sushi-go-party) uses the real apply/view
rules with seeded, physically conserved fixtures. Its separate module never
enters multiplayer initialization. A visible local control advances other seats;
settings select seat, scene and capacity. The default five-player illustrated
table reaches round two through real engine actions. Scenes also cover drafting, Wasabi, Uramaki,
Miso, Menu, Spoon, copied utensils and Takeout.

Implementation validation is recorded in the handoff and evidence index. Pure
seeded matches, real independent Socket.IO clients, and browser journeys are
reported separately. WebKit automation is not physical Safari-device validation.
Physical Safari and a live human group playtest remain unverified.

The [independent review](../handoffs/sushi-go-party-review.md) records rules/privacy
assessment, presentation fixes, exact viewport evidence and remaining device limits.

The [illustrated production migration](../sushi-go-party-redesign.md) adds the
approved desktop board, score pawns and player trays without changing these
rules. Rules/settings remain available in both desktop and compact layouts.
