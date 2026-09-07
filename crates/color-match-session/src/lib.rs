//! Color Match adapter for the shared room authority.
use color_match::{Action, Game, Phase, PlayerId, PlayerView, PublicEvent};
use table_session::GameAdapter;
pub type Authority = table_session::Authority<ColorMatch>;
pub type ActionEnvelope = table_protocol::ActionEnvelope<Action>;
pub type Snapshot = table_protocol::Snapshot<PlayerView, PublicEvent>;
pub struct ColorMatch(pub Game);
impl GameAdapter for ColorMatch {
    type Action = Action;
    type View = PlayerView;
    type Event = PublicEvent;
    type Phase = Phase;
    const GAME_ID: table_protocol::GameId = table_protocol::GameId::ColorMatch;
    const BOTS: bool = true;
    fn view_for(&self, player: PlayerId) -> Result<PlayerView, String> {
        self.0.view_for(player).map_err(|e| e.to_string())
    }
    fn apply(&mut self, player: PlayerId, action: Action) -> Result<Vec<PublicEvent>, String> {
        self.0.apply(player, action).map_err(|e| e.to_string())
    }
    fn revision(&self) -> u64 {
        self.0.revision()
    }
    fn finished(&self) -> bool {
        self.phase().actor().is_none()
    }
    fn phase(&self) -> Phase {
        self.0.phase()
    }
    fn players(&self) -> Vec<PlayerId> {
        self.0.players().to_vec()
    }
    fn matches_room(&self, room: &table_protocol::RoomView) -> bool {
        room.options == table_protocol::RoomOptions::ColorMatch {}
    }
    fn bot_action(&self, player: PlayerId) -> Option<Action> {
        color_match::bot_action(&self.view_for(player).ok()?)
    }
    fn filter_events(&self, _player: PlayerId, events: Vec<PublicEvent>) -> Vec<PublicEvent> {
        events
    }
    fn export_checkpoint(&self) -> Result<String, String> {
        self.0.export_checkpoint()
    }
    fn import_checkpoint(json: &str) -> Result<Self, String> {
        Ok(Self(Game::import_checkpoint(json)?))
    }
}
impl table_browser::Binding for ColorMatch {
    fn authority(seed: [u8; 32], room: &table_protocol::RoomView) -> Result<Authority, String> {
        room.options.validate(Self::GAME_ID)?;
        let players = room.members.iter().map(|m| m.id).collect();
        let game =
            Game::new(seed, color_match::GameConfig { players }).map_err(|e| e.to_string())?;
        Authority::with_game(Self(game), room.round, room.members.clone())
    }
    fn viewer(view: &Self::View) -> PlayerId {
        view.player
    }
    fn view_revision(view: &Self::View) -> u64 {
        view.revision
    }
    fn view_finished(view: &Self::View) -> bool {
        matches!(view.phase, Phase::Finished { .. })
    }
}
#[cfg(test)]
mod tests;
