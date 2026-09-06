use color_match::{Replay, replay};

#[test]
fn version_two_golden_replays() {
    for (input, expected) in [
        (
            include_str!("../../../tests/fixtures/v2/eight.replay.json"),
            include_str!("../../../tests/fixtures/v2/eight.expected.json"),
        ),
        (
            include_str!("../../../tests/fixtures/v2/seed-07.replay.json"),
            include_str!("../../../tests/fixtures/v2/seed-07.expected.json"),
        ),
        (
            include_str!("../../../tests/fixtures/v2/seed-19.replay.json"),
            include_str!("../../../tests/fixtures/v2/seed-19.expected.json"),
        ),
        (
            include_str!("../../../tests/fixtures/v2/recycle.replay.json"),
            include_str!("../../../tests/fixtures/v2/recycle.expected.json"),
        ),
    ] {
        let input: Replay = serde_json::from_str(input).unwrap();
        let output = replay(&input).unwrap();
        assert_eq!(
            format!("{}\n", serde_json::to_string(&output).unwrap()),
            expected
        );
    }
}
