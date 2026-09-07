//! CATAN-only presentation geometry. Pixel layout never enters rule topology.
#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}
#[derive(Debug)]
pub struct TableLayout {
    pub board: Rect,
    pub dice: Rect,
    pub seats: Vec<[f32; 2]>,
}
pub fn bounds(extended: bool) -> [f32; 4] {
    if extended {
        [-7.0, -6.3, 12.3, 12.6]
    } else {
        [-5.5, -4.7, 11.0, 9.4]
    }
}
impl TableLayout {
    pub fn new(w: f32, h: f32, count: usize, extended: bool, sheet: bool) -> Self {
        let narrow = w < 700.0;
        let top = if narrow { 195.0 } else { 126.0 };
        let bottom = if narrow {
            if sheet { 485.0 } else { 255.0 }
        } else {
            172.0
        };
        let available_w = (w - if narrow { 8.0 } else { 310.0 }).max(120.0);
        let available_h = (h - top - bottom).max(120.0);
        let b = bounds(extended);
        let scale = (available_w / b[2]).min(available_h / b[3]);
        let bw = b[2] * scale;
        let bh = b[3] * scale;
        let board = Rect {
            x: (w - bw) / 2.0,
            y: top + (available_h - bh) / 2.0,
            w: bw,
            h: bh,
        };
        let dice = if narrow {
            Rect {
                x: w - 192.0,
                y: h - 176.0,
                w: 180.0,
                h: 104.0,
            }
        } else if w < 1100.0 {
            Rect {
                x: w - 236.0,
                y: h - 326.0,
                w: 210.0,
                h: 182.0,
            }
        } else {
            Rect {
                x: w - 264.0,
                y: h - 266.0,
                w: 238.0,
                h: 182.0,
            }
        };
        let mut seats = vec![[
            if narrow { 42.0 } else { 68.0 },
            h - if narrow { 43.0 } else { 81.0 },
        ]];
        let positions: &[[f32; 2]] = match count {
            3 => &[[0.23, 0.10], [0.77, 0.10]],
            4 => &[[0.06, 0.43], [0.5, 0.075], [0.94, 0.43]],
            5 => &[[0.06, 0.48], [0.29, 0.10], [0.71, 0.10], [0.94, 0.48]],
            _ => &[
                [0.06, 0.50],
                [0.12, 0.34],
                [0.5, 0.075],
                [0.88, 0.34],
                [0.94, 0.50],
            ],
        };
        for (i, p) in positions.iter().enumerate() {
            seats.push(if narrow {
                [(i as f32 + 0.5) * w / (count - 1) as f32, 100.0]
            } else {
                [(w * p[0]).clamp(78.0, w - 78.0), (h * p[1]).max(68.0)]
            });
        }
        Self { board, dice, seats }
    }
    pub fn camera(&self, zoom: f32, pan: [f32; 2]) -> [f32; 3] {
        let z = zoom.clamp(1.0, 3.0);
        [
            z,
            pan[0].clamp(-self.board.w * z / 2.0, self.board.w * z / 2.0),
            pan[1].clamp(-self.board.h * z / 2.0, self.board.h * z / 2.0),
        ]
    }
    /// Keep a selected location above a narrow sheet even after zooming or panning.
    pub fn focus_camera(&self, mut camera: [f32; 3], point: [f32; 2], area: Rect) -> [f32; 3] {
        let [z, x, y] = camera;
        let px = self.board.x + self.board.w / 2.0 + (point[0] - self.board.w / 2.0) * z + x;
        let py = self.board.y + self.board.h / 2.0 + (point[1] - self.board.h / 2.0) * z + y;
        camera[1] += px.clamp(area.x, area.x + area.w) - px;
        camera[2] += py.clamp(area.y, area.y + area.h) - py;
        camera
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fits_all_tables_without_distorting_hexes_or_clipping_dice() {
        for (w, h) in [
            (1920., 1080.),
            (1366., 768.),
            (768., 1024.),
            (1024., 768.),
            (390., 844.),
        ] {
            for count in 3..=6 {
                let l = TableLayout::new(w, h, count, count > 4, false);
                assert_eq!(l.camera(1.0, [0.0, 0.0]), [1.0, 0.0, 0.0]);
                let area = Rect {
                    x: 24.0,
                    y: 195.0,
                    w: w - 48.0,
                    h: 120.0,
                };
                let camera = l.focus_camera([3.0, 500.0, 500.0], [l.board.w, l.board.h], area);
                let focused = [
                    l.board.x + 2.0 * l.board.w + camera[1],
                    l.board.y + 2.0 * l.board.h + camera[2],
                ];
                assert!(
                    focused[0] <= area.x + area.w + 0.001 && focused[1] <= area.y + area.h + 0.001
                );
                let b = bounds(count > 4);
                assert!((l.board.w / l.board.h - b[2] / b[3]).abs() < 0.001);
                assert!(l.board.x >= 0. && l.board.y >= 0. && l.board.y + l.board.h < h);
                assert!(l.dice.x >= 0. && l.dice.x + l.dice.w <= w && l.dice.y + l.dice.h <= h);
                assert_eq!(l.seats.len(), count);
                for (i, a) in l.seats.iter().enumerate() {
                    for b in &l.seats[i + 1..] {
                        assert!((a[0] - b[0]).hypot(a[1] - b[1]) > 60.);
                    }
                }
            }
        }
    }
}
