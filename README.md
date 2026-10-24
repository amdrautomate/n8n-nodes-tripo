# n8n-nodes-tripo

An [n8n](https://n8n.io) community node for [Tripo](https://www.tripo3d.ai), the AI 3D generation platform. Turn text prompts, product photos or multiview shots into textured 3D models, retexture, convert, retopologize, segment, rig and animate them, generate reference images and turntable views, and poll long-running tasks — from your workflows and as tools for AI agents.

Package: `@amdrautomate/n8n-nodes-tripo` · Author: [AMDR Automate](https://amdrautomate.ai) · License: MIT

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Self-hosted: **Settings → Community nodes → Install** and enter `@amdrautomate/n8n-nodes-tripo`.

To let AI agents use the node as a tool on self-hosted n8n, set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

## Credentials

The node authenticates with a Tripo **API key** (sent as `Authorization: Bearer`).

1. Create an account at the [Tripo developer console](https://developers.tripo3d.com) (new accounts get free credits).
2. Open **API Keys** and create a key (it starts with `tsk_`). Copy it; it is shown once.
3. Paste it into the **Tripo API** credential in n8n and click **Test**. The test reads your credit balance.

Every task is billed in credits to the account that owns the key. Credits are frozen when a task starts and released again if it fails or is cancelled. Prices per task type are on the [Tripo pricing page](https://developers.tripo3d.com/en/docs/billing).

## Tripo node

| Resource | Operations |
| --- | --- |
| **Model** | Text to Model, Image to Model, Multiview to Model, Image to Splat, Texture, Convert, Import |
| **Image** | Text to Image, Image to Image, Image to Multiview, Edit Multiview |
| **Animation** | Rig Check, Rig, Retarget |
| **Mesh** | Segment, Complete Parts, Retopologize, Smart UV, Smart Segment |
| **Task** | Get (optionally waits for completion), Get Many (batch status) |
| **File** | Upload (returns a `file_token` to reuse across tasks) |
| **Account** | Get Balance, Get Usage |

### Models

**Text/Image/Multiview to Model** pick the geometry model from a dropdown: the H series (`v3.1-20260211` default, `v3.0`, `v2.5`) for the highest fidelity and the P series (`P2-20260801` preview with native quads, `P1-20260311`) for clean low-poly topology. Options cover face limit, texture and PBR, texture quality and version, geometry quality, quad output, smart low poly, part generation, auto size, orientation and seeds. **Texture** has its own texture model list (v3.5, v3.0, v2.5); **Rig** its rigging versions (v1.0, v2.5, v3.0); **Retopologize** its algorithm tiers (v1.0, v2.0, v3.0 with smart UV); **Text to Image** and **Image to Image** the Seedream, Banana and Chat Image models.

### Inputs

Every image or model input takes one of:

- **Binary Data** of the incoming item (default property `data`) — the node uploads it to Tripo for you and passes the returned `file_token`.
- **URL** — a public http(s) link Tripo downloads.
- **File Token** — a `file_token` from **File → Upload**, handy when one file feeds several tasks.
- **Task ID** — the output of an earlier Tripo task, so you can chain Text to Image → Image to Model → Texture → Rig → Retarget → Convert without downloading anything in between.

Multiview inputs (Multiview to Model, Texture with multiview references) take one field per view (front required, at least two) that accepts a binary property name, URL or file token, or the task ID of an **Image to Multiview** task.

### Waiting and output

All generation and processing calls create an asynchronous Tripo task. With **Wait for Completion** on (the default) the node polls `GET /v3/tasks/{id}` every three seconds until the task succeeds or **Max Wait** runs out (default 10 minutes; 3D generation usually takes 1–5 minutes). Turn it off to get the `task_id` back immediately and collect the result later with **Task → Get**, or let Tripo call an n8n Webhook node (configure the endpoint under Settings → Webhooks in the Tripo console).

A finished task is returned as one item: the task JSON (`task_id`, `type`, `status`, `progress`, `output`, `credits_consumed`, ...) plus, with **Download Files** on (the default), every result file as binary data named after its output key — `model` (GLB/FBX), `pbr_model`, `base_model`, `rendered_image`, `uv_render`, `generated_image`, `front_view` … Result URLs expire, so keep downloads on unless you only need the JSON. **Rig Check** returns `riggable` and the recommended `rig_type` in `output`.

### Example: product photo → game-ready animated character

1. **Image → Image to Image** with template *T-Pose* on the product or character photo (Chat Image 2.5 Flare).
2. **Model → Image to Model** with input *Task ID* from step 1, model `P2-20260801`, options Quad on and Face Limit 20000.
3. **Animation → Rig Check**, then **Animation → Rig** (rigging model v3.0, spec *Unity Humanoid*) on the task ID from step 2.
4. **Animation → Retarget** with `preset:idle, preset:walk, preset:run` and output format FBX.
5. Hand the FBX binary to a storage node, or **Model → Convert** to USDZ for AR Quick Look.

### Using the node as an AI-agent tool

The node is marked `usableAsTool`. Add it to an AI Agent, pick a resource and operation (for example Model → Text to Model), and let the agent fill the prompt with `$fromAI()`. URL and task-ID inputs work well for agents; binary inputs need the file on the incoming item.

### Notes

- Tripo limits concurrent tasks per category (10 for H-series generation, 5 for P-series and model processing, 1 for image generation, 10 for animation and mesh operations) and rate-limits API calls per key. Over the limit the node fails with Tripo's `2000`/`1007` message; run items sequentially or add a Wait node.
- Errors carry Tripo's own message and suggestion plus a hint, for example `2010` → top up credits in the console.
- `Smart UV` needs an input of at most 80,000 triangles; run **Retopologize** first for denser meshes.
- `Export Orientation` on generation applies to that export only; when the model will be textured, rigged or converted afterwards, leave it at the default and set the orientation in the final **Convert**.
- The node has no runtime dependencies; the file upload is encoded by the node itself.

## Compatibility

Built and tested with n8n 2.43 (Node.js 20 and 24). Uses the Tripo API v3 at `https://openapi.tripo3d.com/v3`.

## Resources

- [Tripo API documentation](https://developers.tripo3d.com/en/docs/introduction)
- [Tripo models and versions](https://developers.tripo3d.com/en/docs/models-and-versions)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
