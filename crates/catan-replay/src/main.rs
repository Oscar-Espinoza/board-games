use std::io::{self, Read};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin()
        .take(8 * 1024 * 1024 + 1)
        .read_to_string(&mut input)?;
    if input.len() > 8 * 1024 * 1024 {
        return Err("Replay input too large".into());
    }
    let input = serde_json::from_str(&input)?;
    let result = catan::replay(input).map_err(io::Error::other)?;
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}
