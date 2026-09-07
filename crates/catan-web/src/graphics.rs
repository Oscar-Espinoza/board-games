//! Original illustrated terrain and retained tabletop meshes; recipient views only.
use crate::layout::bounds;
use catan::PlayerView;
use std::{cell::RefCell, f32::consts::TAU};
use wasm_bindgen::{JsCast, prelude::*};
use wgpu::util::DeviceExt;
#[wasm_bindgen(raw_module = "./catan-presentation.js")]
extern "C" {
    fn graphics_lost();
}
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Vertex {
    position: [f32; 3],
    normal: [f32; 3],
    color: [f32; 3],
    material: f32,
    uv: [f32; 2],
}
const PLAYER: [[f32; 3]; 6] = [
    [0.72, 0.10, 0.13],
    [0.10, 0.35, 0.65],
    [0.90, 0.87, 0.75],
    [0.88, 0.33, 0.08],
    [0.13, 0.45, 0.22],
    [0.46, 0.20, 0.59],
];
struct Mesh(Vec<Vertex>);
impl Mesh {
    fn tri(&mut self, p: [[f32; 3]; 3], color: [f32; 3], mat: f32) {
        let a = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
        let b = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
        let n = [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ];
        let length = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt().max(0.001);
        let normal = n.map(|x| x / length);
        self.0.extend(p.map(|position| Vertex {
            position,
            normal,
            color,
            material: mat,
            uv: [0.0, 0.0],
        }));
    }
    fn quad(&mut self, p: [[f32; 3]; 4], c: [f32; 3], m: f32) {
        self.tri([p[0], p[1], p[2]], c, m);
        self.tri([p[0], p[2], p[3]], c, m);
    }
    #[allow(clippy::too_many_arguments)] // Explicit geometric dimensions keep mesh calls readable.
    fn disc(
        &mut self,
        x: f32,
        y: f32,
        z: f32,
        r: f32,
        h: f32,
        c: [f32; 3],
        segments: usize,
        mat: f32,
    ) {
        for i in 0..segments {
            let a = TAU * (i as f32 + if segments == 6 { 0.5 } else { 0.0 }) / segments as f32;
            let b = a + TAU / segments as f32;
            let p = [x + r * a.cos(), y + r * a.sin(), z];
            let q = [x + r * b.cos(), y + r * b.sin(), z];
            self.tri([[x, y, z + h], p, q], c, mat);
        }
    }
    #[allow(clippy::too_many_arguments)] // Position, dimensions, rotation and material.
    fn box_at(
        &mut self,
        x: f32,
        y: f32,
        z: f32,
        w: f32,
        d: f32,
        h: f32,
        angle: f32,
        color: [f32; 3],
    ) {
        let p = |a: f32, b: f32, c: f32| {
            [
                x + a * angle.cos() - b * angle.sin(),
                y + a * angle.sin() + b * angle.cos(),
                z + c,
            ]
        };
        self.quad(
            [p(-w, -d, h), p(w, -d, h), p(w, d, h), p(-w, d, h)],
            color,
            6.0,
        );
        self.quad(
            [p(-w, -d, 0.0), p(w, -d, 0.0), p(w, -d, h), p(-w, -d, h)],
            color,
            6.0,
        );
        self.quad(
            [p(w, -d, 0.0), p(w, d, 0.0), p(w, d, h), p(w, -d, h)],
            color,
            6.0,
        );
        self.quad(
            [p(w, d, 0.0), p(-w, d, 0.0), p(-w, d, h), p(w, d, h)],
            color,
            6.0,
        );
        self.quad(
            [p(-w, d, 0.0), p(-w, -d, 0.0), p(-w, -d, h), p(-w, d, h)],
            color,
            6.0,
        );
    }
    fn roof(&mut self, x: f32, y: f32, z: f32, w: f32, d: f32, c: [f32; 3]) {
        self.quad(
            [
                [x - w, y - d, z],
                [x, y - d, z + 0.22],
                [x, y + d, z + 0.22],
                [x - w, y + d, z],
            ],
            c,
            6.0,
        );
        self.quad(
            [
                [x, y - d, z + 0.22],
                [x + w, y - d, z],
                [x + w, y + d, z],
                [x, y + d, z + 0.22],
            ],
            c,
            6.0,
        );
    }
}
fn geometry(v: &PlayerView, terrain: bool) -> Vec<Vertex> {
    let mut m = Mesh(vec![]);
    if terrain {
        for hex in &v.board.hexes {
            let x = f32::from(2 * hex.q + hex.r) * 0.8660254;
            let y = f32::from(hex.r) * 1.5;
            m.disc(
                x + 0.08,
                y + 0.12,
                0.01,
                1.42,
                0.0,
                [0.08, 0.065, 0.04],
                6,
                -2.0,
            );
            for i in 0..6 {
                let a = (i as f32 + 0.5) * TAU / 6.0;
                let b = (i as f32 + 1.5) * TAU / 6.0;
                let p = [x + 1.36 * a.cos(), y + 1.36 * a.sin(), 0.04];
                let q = [x + 1.36 * b.cos(), y + 1.36 * b.sin(), 0.04];
                m.tri([[x, y, 0.04], p, q], [0.025, 0.34, 0.46], 7.0);
            }
        }
        // Shoreline follows boundary topology, with flat sand and a thin surf edge.
        for [a, b] in &v.board.edges {
            let touching: Vec<_> = v
                .board
                .hexes
                .iter()
                .filter(|h| h.vertices.contains(a) && h.vertices.contains(b))
                .collect();
            if touching.len() != 1 {
                continue;
            }
            let hex = touching[0];
            let center = [
                f32::from(2 * hex.q + hex.r) * 0.8660254,
                f32::from(hex.r) * 1.5,
            ];
            let a = v.board.vertices[*a as usize];
            let b = v.board.vertices[*b as usize];
            let a = [f32::from(a[0]) * 0.8660254, f32::from(a[1]) * 0.5];
            let b = [f32::from(b[0]) * 0.8660254, f32::from(b[1]) * 0.5];
            let normal = [
                ((a[0] + b[0]) / 2.0 - center[0]) / 0.8660254,
                ((a[1] + b[1]) / 2.0 - center[1]) / 0.8660254,
            ];
            for j in 0..16 {
                let edge = |t: f32| [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
                let p = edge(j as f32 / 16.0);
                let q = edge((j + 1) as f32 / 16.0);
                let width = 0.07 + 0.025 * (j as f32 * 0.7).sin();
                let p3 = |p: [f32; 2], distance: f32| {
                    [
                        p[0] + normal[0] * distance,
                        p[1] + normal[1] * distance,
                        0.065,
                    ]
                };
                m.quad(
                    [p3(p, -0.012), p3(q, -0.012), p3(q, width), p3(p, width)],
                    [0.77, 0.59, 0.33],
                    5.0,
                );
                m.quad(
                    [
                        p3(p, width + 0.018),
                        p3(q, width + 0.018),
                        p3(q, width + 0.032),
                        p3(p, width + 0.032),
                    ],
                    [0.40, 0.71, 0.66],
                    -2.0,
                );
            }
        }
        for (index, hex) in v.board.hexes.iter().enumerate() {
            let x = f32::from(2 * hex.q + hex.r) * 0.8660254;
            let y = f32::from(hex.r) * 1.5;
            let c = [1.0, 1.0, 1.0];
            let tile = hex.resource.map_or(5, |r| r as usize) * 2 + index % 2;
            for i in 0..6 {
                let a = (i as f32 + 0.5) * TAU / 6.0;
                let b = (i as f32 + 1.5) * TAU / 6.0;
                let p = [x + 0.97 * a.cos(), y + 0.97 * a.sin(), 0.10];
                let q = [x + 0.97 * b.cos(), y + 0.97 * b.sin(), 0.10];
                let start = m.0.len();
                m.tri([[x, y, 0.10], p, q], c, 8.0);
                for vertex in &mut m.0[start..] {
                    vertex.uv = [
                        (tile % 4) as f32 / 4.0 + (0.5 + (vertex.position[0] - x) * 0.46) / 4.0,
                        (tile / 4) as f32 / 3.0 + (0.5 + (vertex.position[1] - y) * 0.46) / 3.0,
                    ];
                }
                m.quad(
                    [
                        [x + 1.01 * a.cos(), y + 1.01 * a.sin(), 0.055],
                        [x + 1.01 * b.cos(), y + 1.01 * b.sin(), 0.055],
                        q,
                        p,
                    ],
                    [0.66, 0.48, 0.23],
                    5.0,
                );
            }
            if hex.number > 0 {
                m.disc(
                    x + 0.025,
                    y + 0.05,
                    0.115,
                    0.355,
                    0.0,
                    [0.22, 0.20, 0.12],
                    24,
                    -2.0,
                );
                m.disc(x, y, 0.12, 0.33, 0.03, [0.91, 0.82, 0.61], 32, 5.0);
            }
        }
        return m.0;
    }
    for (e, owner) in v.roads.iter().enumerate() {
        if let Some(p) = owner {
            let [a, b] = v.board.edges[e];
            let a = v.board.vertices[a as usize];
            let b = v.board.vertices[b as usize];
            let x = f32::from(a[0] + b[0]) * 0.4330127;
            let y = f32::from(a[1] + b[1]) * 0.25;
            let angle = (f32::from(b[1] - a[1]) * 0.5).atan2(f32::from(b[0] - a[0]) * 0.8660254);
            let color = v.players.iter().find(|v| v.id == *p).unwrap().color;
            m.box_at(
                x + 0.025,
                y + 0.04,
                0.11,
                0.39,
                0.085,
                0.01,
                angle,
                [0.18, 0.14, 0.08],
            );
            m.box_at(x, y, 0.13, 0.38, 0.068, 0.11, angle, PLAYER[color as usize]);
        }
    }
    for (i, b) in v.buildings.iter().enumerate() {
        if let Some(b) = b {
            let p = v.board.vertices[i];
            let x = f32::from(p[0]) * 0.8660254;
            let y = f32::from(p[1]) * 0.5;
            let c = PLAYER[b.color as usize];
            m.disc(
                x + 0.05,
                y + 0.07,
                0.13,
                if b.city { 0.34 } else { 0.24 },
                0.0,
                [0.16, 0.13, 0.08],
                12,
                -2.0,
            );
            m.box_at(x, y, 0.15, 0.17, 0.16, 0.16, 0.0, c);
            m.roof(x, y, 0.31, 0.20, 0.18, c);
            if b.city {
                m.box_at(x + 0.19, y, 0.15, 0.12, 0.16, 0.25, 0.0, c);
                m.roof(x + 0.19, y, 0.4, 0.14, 0.18, c);
            }
        }
    }
    let hex = &v.board.hexes[v.robber as usize];
    let x = f32::from(2 * hex.q + hex.r) * 0.8660254;
    let y = f32::from(hex.r) * 1.5 - 0.36;
    m.disc(
        x + 0.07,
        y + 0.1,
        0.16,
        0.21,
        0.0,
        [0.20, 0.17, 0.10],
        18,
        -2.0,
    );
    m.disc(x, y, 0.16, 0.17, 0.24, [0.12, 0.09, 0.06], 20, 6.0);
    m.disc(x, y, 0.39, 0.12, 0.20, [0.17, 0.12, 0.08], 20, 6.0);
    m.0
}
struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    uniform: wgpu::Buffer,
    bind: wgpu::BindGroup,
    canvas: web_sys::HtmlCanvasElement,
    depth: wgpu::TextureView,
    msaa: wgpu::TextureView,
    samples: u32,
    terrain_buffer: Option<(wgpu::Buffer, u32)>,
    pieces_buffer: Option<(wgpu::Buffer, u32)>,
}
thread_local! {
    static GPU: RefCell<Option<Renderer>> = const { RefCell::new(None) };
    static VIEW: RefCell<Option<PlayerView>> = const { RefCell::new(None) };
    static STATIC: RefCell<Vec<Vertex>> = const { RefCell::new(vec![]) };
    static PIECES: RefCell<Vec<Vertex>> = const { RefCell::new(vec![]) };
}
pub fn set_view(view: PlayerView) {
    let (terrain_changed, pieces_changed) = VIEW.with(|v| {
        let old = v.borrow();
        (
            old.as_ref().is_none_or(|old| old.board != view.board),
            old.as_ref().is_none_or(|old| {
                old.roads != view.roads
                    || old.buildings != view.buildings
                    || old.robber != view.robber
                    || old
                        .players
                        .iter()
                        .map(|p| (p.id, p.color))
                        .ne(view.players.iter().map(|p| (p.id, p.color)))
            }),
        )
    });
    if terrain_changed {
        STATIC.with(|s| *s.borrow_mut() = geometry(&view, true));
    }
    if terrain_changed || pieces_changed {
        PIECES.with(|s| *s.borrow_mut() = geometry(&view, false));
    }
    GPU.with(|g| {
        if let Some(g) = g.borrow_mut().as_mut() {
            if terrain_changed {
                g.terrain_buffer = None;
            }
            if terrain_changed || pieces_changed {
                g.pieces_buffer = None;
            }
        }
    });
    VIEW.with(|v| *v.borrow_mut() = Some(view));
}
#[wasm_bindgen]
pub async fn initialize_graphics(force_gl: bool, atlas: Vec<u8>) -> Result<String, JsValue> {
    if atlas.len() != 1024 * 768 * 4 {
        return Err(JsValue::from_str("Invalid terrain atlas"));
    }
    GPU.with(|g| *g.borrow_mut() = None);
    let window = web_sys::window().unwrap();
    let doc = window.document().unwrap();
    let canvas = doc
        .get_element_by_id("table-canvas")
        .unwrap()
        .dyn_into::<web_sys::HtmlCanvasElement>()?;
    let backend = if force_gl {
        wgpu::Backends::GL
    } else {
        wgpu::Backends::BROWSER_WEBGPU
    };
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: backend,
        ..Default::default()
    });
    let surface = instance
        .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::LowPower,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        })
        .await
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: Some("CATAN tabletop"),
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
            memory_hints: wgpu::MemoryHints::MemoryUsage,
            trace: wgpu::Trace::Off,
        })
        .await
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    device.set_device_lost_callback(|reason, _| {
        if reason == wgpu::DeviceLostReason::Unknown {
            graphics_lost();
        }
    });
    let caps = surface.get_capabilities(&adapter);
    let format = caps
        .formats
        .iter()
        .find(|f| f.is_srgb())
        .copied()
        .unwrap_or(caps.formats[0]);
    let samples = if adapter.get_texture_format_features(format).flags.contains(
        wgpu::TextureFormatFeatureFlags::MULTISAMPLE_X4
            | wgpu::TextureFormatFeatureFlags::MULTISAMPLE_RESOLVE,
    ) && adapter
        .get_texture_format_features(wgpu::TextureFormat::Depth24Plus)
        .flags
        .contains(wgpu::TextureFormatFeatureFlags::MULTISAMPLE_X4)
    {
        4
    } else {
        1
    };
    let config = wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format,
        width: 1400,
        height: 1200,
        present_mode: wgpu::PresentMode::Fifo,
        // wgpu 26's WebGPU capabilities report only Opaque, but its configure
        // implementation supports the WebGPU-required premultiplied mode.
        alpha_mode: if !force_gl {
            wgpu::CompositeAlphaMode::PreMultiplied
        } else {
            caps.alpha_modes
                .iter()
                .copied()
                .find(|m| *m == wgpu::CompositeAlphaMode::PreMultiplied)
                .unwrap_or(caps.alpha_modes[0])
        },
        view_formats: vec![],
        desired_maximum_frame_latency: 2,
    };
    canvas.set_width(config.width);
    canvas.set_height(config.height);
    surface.configure(&device, &config);
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("original tabletop materials"),
        source: wgpu::ShaderSource::Wgsl(include_str!("table.wgsl").into()),
    });
    // SVG rasterization yields sRGB pixels. The GPU decodes them before lighting.
    // Mips average linear light and re-encode to avoid dark seams and halos.
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("original illustrated terrain atlas"),
        size: wgpu::Extent3d {
            width: 1024,
            height: 768,
            depth_or_array_layers: 1,
        },
        mip_level_count: 5,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8UnormSrgb,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    let mut pixels = atlas;
    let (mut tw, mut th) = (1024u32, 768u32);
    for level in 0..5 {
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: level,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &pixels,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(tw * 4),
                rows_per_image: Some(th),
            },
            wgpu::Extent3d {
                width: tw,
                height: th,
                depth_or_array_layers: 1,
            },
        );
        if level < 4 {
            pixels = mip(&pixels, tw, th);
            tw /= 2;
            th /= 2;
        }
    }
    let atlas_view = texture.create_view(&Default::default());
    let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        label: Some("terrain mip filter"),
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        mipmap_filter: wgpu::FilterMode::Linear,
        ..Default::default()
    });
    let mut camera = bounds(false).to_vec();
    camera.extend([if format.is_srgb() { 0.0 } else { 1.0 }, 0.0, 0.0, 0.0]);
    let uniform = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: None,
        contents: bytemuck::cast_slice(&camera),
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    });
    let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: None,
        entries: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 1,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Texture {
                    sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    view_dimension: wgpu::TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 2,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                count: None,
            },
        ],
    });
    let bind = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout: &layout,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::TextureView(&atlas_view),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::Sampler(&sampler),
            },
        ],
    });
    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[&layout],
        push_constant_ranges: &[],
    });
    let attributes = wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x3, 3 => Float32, 4 => Float32x2];
    let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some("CATAN board"),
        layout: Some(&pipeline_layout),
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: Some("vs"),
            compilation_options: Default::default(),
            buffers: &[wgpu::VertexBufferLayout {
                array_stride: 48,
                step_mode: wgpu::VertexStepMode::Vertex,
                attributes: &attributes,
            }],
        },
        fragment: Some(wgpu::FragmentState {
            module: &shader,
            entry_point: Some("fs"),
            compilation_options: Default::default(),
            targets: &[Some(wgpu::ColorTargetState {
                format,
                blend: None,
                write_mask: wgpu::ColorWrites::ALL,
            })],
        }),
        primitive: wgpu::PrimitiveState {
            cull_mode: None,
            ..Default::default()
        },
        depth_stencil: Some(wgpu::DepthStencilState {
            format: wgpu::TextureFormat::Depth24Plus,
            depth_write_enabled: true,
            depth_compare: wgpu::CompareFunction::LessEqual,
            stencil: Default::default(),
            bias: Default::default(),
        }),
        multisample: wgpu::MultisampleState {
            count: samples,
            ..Default::default()
        },
        multiview: None,
        cache: None,
    });
    let depth = attachment(
        &device,
        config.width,
        config.height,
        samples,
        wgpu::TextureFormat::Depth24Plus,
    );
    let msaa = attachment(&device, config.width, config.height, samples, format);
    let _ = doc
        .get_element_by_id("board")
        .unwrap()
        .set_attribute("data-samples", &samples.to_string());
    GPU.with(|g| {
        *g.borrow_mut() = Some(Renderer {
            device,
            queue,
            surface,
            config,
            pipeline,
            uniform,
            bind,
            canvas,
            depth,
            msaa,
            samples,
            terrain_buffer: None,
            pieces_buffer: None,
        })
    });
    Ok(if force_gl { "webgl2" } else { "webgpu" }.into())
}
fn attachment(
    device: &wgpu::Device,
    width: u32,
    height: u32,
    samples: u32,
    format: wgpu::TextureFormat,
) -> wgpu::TextureView {
    device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some("board depth"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: samples,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        })
        .create_view(&Default::default())
}
#[wasm_bindgen]
pub fn draw_frame(_progress: f32) -> Result<(), JsValue> {
    let board_bounds = VIEW.with(|v| {
        v.borrow()
            .as_ref()
            .map(|v| bounds(v.board.hexes.len() > 19))
    });
    let Some(b) = board_bounds else { return Ok(()) };
    GPU.with(|g| {
        let mut gpu = g.borrow_mut();
        let Some(g) = gpu.as_mut() else { return Ok(()) };
        let rect = g.canvas.client_width().max(1) as f64;
        let ratio = web_sys::window().unwrap().device_pixel_ratio().min(1.5);
        let width = (rect * ratio).min(1800.0) as u32;
        let height = ((g.canvas.client_height().max(1) as f64 * ratio).min(1800.0) as u32).max(1);
        if g.config.width != width || g.config.height != height {
            g.canvas.set_width(width);
            g.canvas.set_height(height);
            g.config.width = width;
            g.config.height = height;
            g.surface.configure(&g.device, &g.config);
            g.depth = attachment(
                &g.device,
                width,
                height,
                g.samples,
                wgpu::TextureFormat::Depth24Plus,
            );
            g.msaa = attachment(&g.device, width, height, g.samples, g.config.format);
        }
        g.queue
            .write_buffer(&g.uniform, 0, bytemuck::cast_slice(&b));
        let frame = match g.surface.get_current_texture() {
            Ok(f) => f,
            Err(wgpu::SurfaceError::Lost | wgpu::SurfaceError::Outdated) => {
                g.surface.configure(&g.device, &g.config);
                return Ok(());
            }
            Err(e) => return Err(JsValue::from_str(&e.to_string())),
        };
        let target = frame.texture.create_view(&Default::default());
        if g.terrain_buffer.is_none() {
            g.terrain_buffer = Some(STATIC.with(|v| upload(&g.device, &v.borrow())));
        }
        if g.pieces_buffer.is_none() {
            g.pieces_buffer = Some(PIECES.with(|v| upload(&g.device, &v.borrow())));
        }
        let mut encoder = g.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: if g.samples > 1 { &g.msaa } else { &target },
                    depth_slice: None,
                    resolve_target: if g.samples > 1 { Some(&target) } else { None },
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &g.depth,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
            });
            pass.set_pipeline(&g.pipeline);
            pass.set_bind_group(0, &g.bind, &[]);
            for (buffer, count) in [
                g.terrain_buffer.as_ref().unwrap(),
                g.pieces_buffer.as_ref().unwrap(),
            ] {
                if *count > 0 {
                    pass.set_vertex_buffer(0, buffer.slice(..));
                    pass.draw(0..*count, 0..1);
                }
            }
        }
        g.queue.submit([encoder.finish()]);
        frame.present();
        Ok(())
    })
}

fn upload(device: &wgpu::Device, vertices: &[Vertex]) -> (wgpu::Buffer, u32) {
    (
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("retained tabletop geometry"),
            contents: bytemuck::cast_slice(vertices),
            usage: wgpu::BufferUsages::VERTEX,
        }),
        vertices.len() as u32,
    )
}
fn mip(pixels: &[u8], w: u32, h: u32) -> Vec<u8> {
    let mut result = vec![255; (w * h) as usize];
    let linear = |v: u8| {
        let x = f32::from(v) / 255.0;
        if x <= 0.04045 {
            x / 12.92
        } else {
            ((x + 0.055) / 1.055).powf(2.4)
        }
    };
    for y in 0..h / 2 {
        for x in 0..w / 2 {
            for c in 0..3 {
                let mut value = 0.0;
                for dy in 0..2 {
                    for dx in 0..2 {
                        value += linear(pixels[(((y * 2 + dy) * w + x * 2 + dx) * 4 + c) as usize])
                            / 4.0;
                    }
                }
                let encoded = if value <= 0.0031308 {
                    value * 12.92
                } else {
                    1.055 * value.powf(1.0 / 2.4) - 0.055
                };
                result[((y * (w / 2) + x) * 4 + c) as usize] = (encoded * 255.0).round() as u8;
            }
        }
    }
    result
}
