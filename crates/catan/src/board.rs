//! Integer topology. Hex IDs are row-major; vertices/edges are sorted coordinates.
use crate::Resource;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Hex {
    pub q: i8,
    pub r: i8,
    pub resource: Option<Resource>,
    pub number: u8,
    pub vertices: [u8; 6],
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub hexes: Vec<Hex>,
    pub vertices: Vec<[i8; 2]>,
    pub edges: Vec<[u8; 2]>,
    pub ports: Vec<Port>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Port {
    pub edge: u8,
    pub resource: Option<Resource>,
}
const CORNERS: [[i8; 2]; 6] = [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]];
impl Board {
    pub fn new(extended: bool) -> Self {
        let radius = if extended { 3i8 } else { 2 };
        let mut coordinates = vec![];
        for r in -radius..=radius {
            for q in (-radius).max(-r - radius)..=2.min(2 - r) {
                coordinates.push((q, r));
            }
        }
        let points: BTreeSet<_> = coordinates
            .iter()
            .flat_map(|(q, r)| CORNERS.map(|[x, y]| [2 * q + r + x, 3 * r + y]))
            .collect();
        let vertices: Vec<_> = points.into_iter().collect();
        let ids: BTreeMap<_, _> = vertices
            .iter()
            .enumerate()
            .map(|(i, p)| (*p, i as u8))
            .collect();
        let hexes: Vec<_> = coordinates
            .into_iter()
            .map(|(q, r)| Hex {
                q,
                r,
                resource: None,
                number: 0,
                vertices: CORNERS.map(|[x, y]| ids[&[2 * q + r + x, 3 * r + y]]),
            })
            .collect();
        let edges = hexes
            .iter()
            .flat_map(|h| {
                (0..6).map(move |i| {
                    let mut edge = [h.vertices[i], h.vertices[(i + 1) % 6]];
                    edge.sort();
                    edge
                })
            })
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        Self {
            hexes,
            vertices,
            edges,
            ports: vec![],
        }
    }
    pub fn edge(&self, a: u8, b: u8) -> u8 {
        let mut e = [a, b];
        e.sort();
        self.edges
            .iter()
            .position(|v| *v == e)
            .expect("adjacent vertices") as u8
    }
    pub fn hex_edge(&self, h: usize, c: usize) -> u8 {
        self.edge(
            self.hexes[h].vertices[c],
            self.hexes[h].vertices[(c + 1) % 6],
        )
    }
    pub fn incident(&self, v: u8) -> impl Iterator<Item = (usize, [u8; 2])> + '_ {
        self.edges
            .iter()
            .copied()
            .enumerate()
            .filter(move |(_, e)| e.contains(&v))
    }
    pub fn adjacent_hexes(&self, v: u8) -> impl Iterator<Item = usize> + '_ {
        self.hexes
            .iter()
            .enumerate()
            .filter(move |(_, h)| h.vertices.contains(&v))
            .map(|(i, _)| i)
    }
    /// Walk each ring counterclockwise from the northeast corner, then peel inward.
    pub fn spiral(&self) -> Vec<usize> {
        let dirs = [(-1, 0), (-1, 1), (0, 1), (1, 0), (1, -1), (0, -1)];
        let mut remaining: BTreeSet<_> = (0..self.hexes.len()).collect();
        let mut result = vec![];
        while !remaining.is_empty() {
            let mut current = *remaining
                .iter()
                .min_by_key(|i| (self.hexes[**i].r, -self.hexes[**i].q))
                .unwrap();
            result.push(current);
            remaining.remove(&current);
            for (dq, dr) in dirs {
                loop {
                    let h = &self.hexes[current];
                    let next = remaining
                        .iter()
                        .find(|i| {
                            let n = &self.hexes[**i];
                            n.q == h.q + dq && n.r == h.r + dr
                        })
                        .copied();
                    if let Some(i) = next {
                        result.push(i);
                        remaining.remove(&i);
                        current = i;
                    } else {
                        break;
                    }
                }
            }
        }
        result
    }
    /// Ordered coastal edges, walking counterclockwise from the northwestern tip.
    pub fn coast(&self) -> Vec<u8> {
        let coast: Vec<_> = self
            .edges
            .iter()
            .enumerate()
            .filter(|(_, edge)| {
                self.hexes
                    .iter()
                    .filter(|h| edge.iter().all(|v| h.vertices.contains(v)))
                    .count()
                    == 1
            })
            .map(|(i, _)| i as u8)
            .collect();
        let start = *coast
            .iter()
            .flat_map(|e| self.edges[*e as usize].iter())
            .min_by_key(|v| {
                (
                    self.vertices[**v as usize][1],
                    self.vertices[**v as usize][0],
                )
            })
            .unwrap();
        let mut current = start;
        let mut result: Vec<u8> = vec![];
        loop {
            let edge = *coast
                .iter()
                .filter(|e| self.edges[**e as usize].contains(&current) && !result.contains(*e))
                .min_by_key(|e| {
                    let ends = self.edges[**e as usize];
                    let v = if ends[0] == current { ends[1] } else { ends[0] };
                    self.vertices[v as usize][0]
                })
                .unwrap();
            result.push(edge);
            let ends = self.edges[edge as usize];
            current = if ends[0] == current { ends[1] } else { ends[0] };
            if current == start {
                break;
            }
        }
        result
    }
    pub fn variable_ports(&mut self, order: &[usize]) {
        use Resource::*;
        // Six five-edge frame sections; extension adds four two-edge sections.
        // Ports remain attached to their section when it is shuffled.
        type FrameSection = (usize, &'static [(usize, Option<Resource>)]);
        let sections: [FrameSection; 10] = [
            (5, &[(0, None), (3, Some(Wood))]),
            (5, &[(1, None)]),
            (5, &[(0, None), (3, Some(Brick))]),
            (5, &[(1, Some(Wool))]),
            (5, &[(0, None), (3, Some(Wheat))]),
            (5, &[(1, Some(Ore))]),
            (2, &[]),
            (2, &[]),
            (2, &[(0, None)]),
            (2, &[(0, Some(Wool))]),
        ];
        let coast = self.coast();
        let mut offset = 0;
        self.ports.clear();
        for index in order {
            let (length, ports) = sections[*index];
            for (position, resource) in ports {
                self.ports.push(Port {
                    edge: coast[offset + position],
                    resource: *resource,
                });
            }
            offset += length;
        }
        debug_assert_eq!(offset, coast.len());
    }
    pub fn fixed_terrain(&mut self) {
        use Resource::*;
        let base = [
            (None, 0),
            (Some(Wheat), 8),
            (Some(Wool), 11),
            (Some(Brick), 6),
            (Some(Wool), 3),
            (Some(Wood), 4),
            (Some(Ore), 9),
            (Some(Wood), 10),
            (Some(Wheat), 5),
            (Some(Brick), 12),
            (Some(Wood), 11),
            (Some(Wool), 5),
            (Some(Wheat), 2),
            (Some(Brick), 9),
            (Some(Ore), 4),
            (Some(Wood), 8),
            (Some(Ore), 6),
            (Some(Wheat), 3),
            (Some(Wool), 10),
        ];
        let ext = [
            (Some(Brick), 10),
            (Some(Wool), 6),
            (None, 0),
            (Some(Brick), 6),
            (Some(Wheat), 2),
            (Some(Ore), 9),
            (Some(Brick), 11),
            (Some(Wood), 3),
            (Some(Ore), 11),
            (Some(Wood), 5),
            (Some(Wheat), 10),
            (Some(Wool), 4),
            (None, 0),
            (Some(Wool), 5),
            (Some(Wheat), 4),
            (Some(Ore), 6),
            (Some(Wool), 3),
            (Some(Wheat), 8),
            (Some(Wood), 12),
            (Some(Ore), 10),
            (Some(Wool), 2),
            (Some(Brick), 4),
            (Some(Wood), 11),
            (Some(Wood), 8),
            (Some(Wheat), 3),
            (Some(Wood), 9),
            (Some(Wheat), 5),
            (Some(Brick), 9),
            (Some(Wool), 12),
            (Some(Ore), 8),
        ];
        let tiles: &[(Option<Resource>, u8)] = if self.hexes.len() == 19 { &base } else { &ext };
        for (h, (r, n)) in self.hexes.iter_mut().zip(tiles) {
            h.resource = *r;
            h.number = *n;
        }
    }
    pub fn fixed_ports(&mut self) {
        use Resource::*;
        let base = [
            (0, 5, None),
            (2, 5, Some(Wood)),
            (2, 1, None),
            (6, 1, None),
            (11, 1, None),
            (15, 2, Some(Brick)),
            (18, 2, Some(Wool)),
            (16, 3, None),
            (12, 4, Some(Wheat)),
            (3, 4, Some(Ore)),
        ];
        // The northeast coast has one general port (not one on each adjacent hex).
        let selected: Vec<_> = if self.hexes.len() == 19 {
            base.into_iter().filter(|(h, _, _)| *h != 6).collect()
        } else {
            vec![
                (0, 5, None),
                (1, 0, Some(Wood)),
                (2, 1, None),
                (11, 1, None),
                (17, 1, Some(Wool)),
                (22, 2, Some(Brick)),
                (29, 2, None),
                (28, 3, Some(Wheat)),
                (27, 4, None),
                (18, 4, Some(Wool)),
                (7, 4, Some(Ore)),
            ]
        };
        self.ports = selected
            .into_iter()
            .map(|(h, c, r)| Port {
                edge: self.hex_edge(h, c),
                resource: r,
            })
            .collect();
    }
}
