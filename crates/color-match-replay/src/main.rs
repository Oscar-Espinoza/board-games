use std::io::{self, Read, Write};
use std::process::ExitCode;

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let value: serde_json::Value = serde_json::from_str(&input)?;
    if value.get("version").and_then(|v| v.as_u64()) != Some(u64::from(color_match::REPLAY_VERSION))
    {
        return Err(io::Error::other("unsupported replay version (expected 2)").into());
    }
    let replay = serde_json::from_value(value)?;
    let result = color_match::replay(&replay).map_err(io::Error::other)?;
    let mut output = io::stdout().lock();
    serde_json::to_writer(&mut output, &result)?;
    writeln!(output)?;
    Ok(())
}
fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("replay error: {error}");
            ExitCode::FAILURE
        }
    }
}
