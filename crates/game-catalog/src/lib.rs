//! Discovery metadata, independent of room protocols and game runtimes.
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    BoardGames,
}
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PlayMode {
    Solo,
    Table { min_players: u8, max_players: u8 },
}
#[derive(Serialize)]
pub struct CatalogEntry {
    pub id: &'static str,
    pub name: &'static str,
    pub route: &'static str,
    pub category: Category,
    pub preview: &'static str,
    pub modes: &'static [PlayMode],
}
pub const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        id: "color-match",
        name: "Color Match",
        route: "/games/color-match/",
        category: Category::BoardGames,
        preview: "CM",
        modes: &[PlayMode::Table {
            min_players: 2,
            max_players: 8,
        }],
    },
    CatalogEntry {
        id: "catan",
        name: "CATAN",
        route: "/games/catan/",
        category: Category::BoardGames,
        preview: "⬡",
        modes: &[PlayMode::Table {
            min_players: 3,
            max_players: 6,
        }],
    },
];
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn table_registrations_agree_in_both_directions() {
        for entry in CATALOG {
            for mode in entry.modes {
                if let PlayMode::Table {
                    min_players,
                    max_players,
                } = mode
                {
                    let registration = table_protocol::TABLE_GAMES
                        .iter()
                        .find(|r| serde_json::to_value(r.id).unwrap() == entry.id)
                        .expect("table registration");
                    assert_eq!(
                        (*min_players, *max_players),
                        (registration.min_players, registration.max_players)
                    );
                    assert!(registration.playable);
                }
            }
        }
        for registration in &table_protocol::TABLE_GAMES {
            assert!(
                CATALOG
                    .iter()
                    .any(|e| serde_json::to_value(registration.id).unwrap() == e.id
                        && e.modes.iter().any(|m| matches!(m, PlayMode::Table { .. })))
            );
        }
        let ids: std::collections::HashSet<_> = CATALOG.iter().map(|e| e.id).collect();
        let routes: std::collections::HashSet<_> = CATALOG.iter().map(|e| e.route).collect();
        assert_eq!(ids.len(), CATALOG.len());
        assert_eq!(routes.len(), CATALOG.len());
    }
}
