//! Browser-only static DOM helpers. Loaders validate the static IDs before startup;
//! dynamically created game controls remain the responsibility of each renderer.
use wasm_bindgen::JsValue;
use web_sys::{Document, Element};
pub fn validate_required(ids: &[&str]) -> Result<(), JsValue> {
    let document = web_sys::window()
        .and_then(|w| w.document())
        .ok_or_else(|| JsValue::from_str("Missing browser document"))?;
    for id in ids {
        if document.get_element_by_id(id).is_none() {
            return Err(JsValue::from_str(&format!(
                "Missing required element #{id}"
            )));
        }
    }
    Ok(())
}
pub fn document() -> Document {
    web_sys::window().unwrap().document().unwrap()
}
pub fn el(id: &str) -> Element {
    document()
        .get_element_by_id(id)
        .expect("static DOM validated at startup")
}
pub fn text(id: &str, value: &str) {
    el(id).set_text_content(Some(value));
}
pub fn attr(id: &str, key: &str, value: &str) {
    let _ = el(id).set_attribute(key, value);
}
fn toggle(id: &str, attribute: &str, value: bool) {
    if value {
        attr(id, attribute, "");
    } else {
        let _ = el(id).remove_attribute(attribute);
    }
}
pub fn hidden(id: &str, value: bool) {
    toggle(id, "hidden", value);
}
pub fn disabled(id: &str, value: bool) {
    toggle(id, "disabled", value);
}
pub fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
