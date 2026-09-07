fn main() {
    println!("{}", serde_json::to_string(game_catalog::CATALOG).unwrap());
}
