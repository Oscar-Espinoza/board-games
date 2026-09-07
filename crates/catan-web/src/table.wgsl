struct Camera { bounds:vec4<f32>, output:vec4<f32> }
@group(0) @binding(0) var<uniform> camera:Camera;
@group(0) @binding(1) var terrain:texture_2d<f32>;
@group(0) @binding(2) var paint_sampler:sampler;
struct Out { @builtin(position) pos:vec4<f32>, @location(0) world:vec3<f32>, @location(1) normal:vec3<f32>, @location(2) color:vec3<f32>, @location(3) material:f32, @location(4) uv:vec2<f32> }
@vertex fn vs(@location(0) position:vec3<f32>,@location(1) normal:vec3<f32>,@location(2) color:vec3<f32>,@location(3) material:f32,@location(4) uv:vec2<f32>)->Out {
    var o:Out;
    o.pos=vec4<f32>((position.x-camera.bounds.x)/camera.bounds.z*2.0-1.0,1.0-(position.y-camera.bounds.y)/camera.bounds.w*2.0,0.9-position.z*0.1,1.0);
    o.world=position;o.normal=normal;o.color=color;o.material=material;o.uv=uv;return o;
}
fn encode(c:vec3<f32>)->vec3<f32> {return select(1.055*pow(max(c,vec3<f32>(0.0)),vec3<f32>(1.0/2.4))-0.055,c*12.92,c<=vec3<f32>(0.0031308));}
@fragment fn fs(i:Out)->@location(0) vec4<f32> {
    let painting=textureSample(terrain,paint_sampler,i.uv).rgb;
    var c=i.color;
    let light=0.78+0.22*max(dot(normalize(i.normal),normalize(vec3<f32>(-0.45,-0.55,1.0))),0.0);
    if i.material>7.5 {c=painting*0.98;}
    else if i.material>6.5 {
        let wave=0.5+0.5*sin(i.world.x*15.0+sin(i.world.y*8.0)*1.6);
        c=c*(0.90+wave*0.10);
    } else if i.material>5.5 {c=c*light*(0.96+0.04*sin(i.world.x*125.0+sin(i.world.y*15.0)));}
    else if i.material > -1.5 {c=c*light;}
    if camera.output.x>0.5 {c=encode(c);}
    return vec4<f32>(c,1.0);
}
