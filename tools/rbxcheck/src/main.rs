//! Checks a Roblox model file the way Rojo reads one: rbx_xml refuses unknown properties, each
//! property's type and enum value is checked against Roblox's reflection database, and the
//! result is written to Roblox's binary format. Framecraft's .rbxmx export is checked with it.
use std::{env, fs};
use rbx_dom_weak::{types::{Ref, Variant}, WeakDom};
use rbx_reflection::DataType;
use rbx_xml::{DecodeOptions, DecodePropertyBehavior};

/// Prints every object with its properties, and checks each property's type (and enum value)
/// against Roblox's reflection database. Exits 1 on any mismatch.
fn dump(dom: &WeakDom, r: Ref, depth: usize, errors: &mut Vec<String>) {
    let db = rbx_reflection_database::get().unwrap();
    let inst = dom.get_by_ref(r).unwrap();
    println!("{}{} ({})", "  ".repeat(depth), inst.name, inst.class);
    let class = db.classes.get(inst.class.as_str()).expect("unknown class");
    let mut props: Vec<_> = inst.properties.iter().collect();
    props.sort_by(|a, b| a.0.as_str().cmp(b.0.as_str()));
    for (k, v) in props {
        println!("{}  .{} = {:?}", "  ".repeat(depth), k, v);
        let desc = db.superclasses(class).unwrap().into_iter()
            .find_map(|c| c.properties.get(k.as_str()));
        match desc {
            None => errors.push(format!("{}.{}: unknown property", inst.class, k)),
            Some(d) => match (&d.data_type, v) {
                (DataType::Enum(name), Variant::Enum(e)) => {
                    let en = db.enums.get(&**name as &str).unwrap();
                    if !en.items.values().any(|x| *x == e.to_u32()) {
                        errors.push(format!("{}.{}: {} has no value {}", inst.class, k, name, e.to_u32()));
                    }
                }
                (DataType::Value(t), v) if *t == v.ty() => {}
                (t, v) => errors.push(format!("{}.{}: expected {:?}, got {:?}", inst.class, k, t, v.ty())),
            },
        }
    }
    for c in inst.children() { dump(dom, *c, depth + 1, errors); }
}

fn main() {
    let path = env::args().nth(1).unwrap();
    let text = fs::read(&path).unwrap();
    let opts = DecodeOptions::new().property_behavior(DecodePropertyBehavior::ErrorOnUnknown);
    let dom = rbx_xml::from_reader(text.as_slice(), opts).expect("decode");
    let mut errors = Vec::new();
    for c in dom.root().children() { dump(&dom, *c, 0, &mut errors); }
    let mut out = Vec::new();
    rbx_binary::to_writer(&mut out, &dom, dom.root().children()).expect("binary");
    println!("binary ok, {} bytes", out.len());
    for e in &errors { eprintln!("ERROR {}", e); }
    if !errors.is_empty() { std::process::exit(1); }
}
