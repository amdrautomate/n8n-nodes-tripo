# Changelog

## 0.1.0

- Initial release, built on the Tripo API v3.
- **Model**: Text to Model, Image to Model, Multiview to Model (H series v3.1/v3.0/v2.5 and P series P2/P1), Image to Splat, Texture (text, single-image or multiview guidance), Convert (GLTF, FBX, USDZ, OBJ, STL, 3MF), Import.
- **Image**: Text to Image, Image to Image, Image to Multiview, Edit Multiview (Seedream, Banana and Chat Image models).
- **Animation**: Rig Check, Rig (v1.0 / v2.5 / v3.0, skeleton specs), Retarget (up to five presets).
- **Mesh**: Segment, Complete Parts, Retopologize (v1.0 / v2.0 / v3.0 with smart UV), Smart UV, Smart Segment.
- **Task**: Get (with optional waiting), Get Many. **File**: Upload. **Account**: Get Balance, Get Usage.
- Inputs come from binary data (uploaded for you), public URLs, file tokens or earlier task IDs; results are downloaded into binary data named after the output key. Wait for Completion polls tasks with a configurable Max Wait.
