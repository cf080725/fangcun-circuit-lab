"""Create a four-leg tactile switch in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/tactile_button.py -- --output dist/models/tactile-button.glb

Use --render to produce a studio PNG with the native through-hole leads.
The geometry is an independent reconstruction based on nominal dimensions
of the ungrounded Omron B3F-1000. Edge details and surface finish are visual
approximations. No manufacturer's artwork or CAD mesh is used.

The web scene reads centimetres with +Y up and y=0 at the seating surface.
BUTTON_CAP has its own pivot. BUTTON_NATIVE_LEADS can be omitted so the lab
can route formed leads to the existing teaching endpoints instead.

https://components.omron.com/us-en/datasheet_pdf/A070-E1.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://components.omron.com/us-en/datasheet_pdf/A070-E1.pdf"
HOUSING = .600
PLATE_Y, TOP_Y, CAP_RADIUS, PRETRAVEL = .340, .430, .175, .025
PIN_X, PIN_Z = .325, .225
TERMINAL_EXIT_Y, LEAD_LENGTH = .084, .350


def housing(parent, mats):
    base = MeshBatch()
    base.loft([(.014, .564, .564, .033), (.037, HOUSING, HOUSING, .032),
               (.272, HOUSING, HOUSING, .034), (.308, .581, .581, .030)], mats["case"])
    for x in [-.245, .245]:
        for z in [-.247, .247]:
            base.box((x, .016, z), (.076, .032, .074), mats["case"], .009)
    case = base.finish("BUTTON_MOLDED_CASE", parent)
    well = MeshBatch()
    well.cylindrical(0, 0, [(.188, .232), (.188, .328)], mats["case"], 48, True)
    cut_mesh(case, well.finish("Plunger travel well cutter", parent))

    retainer = MeshBatch()
    retainer.loft([(.301, .570, .570, .035), (.315, .594, .594, .036),
                   (.332, .594, .594, .036), (PLATE_Y, .574, .574, .033)], mats["steel"])
    cover = retainer.finish("BUTTON_STAMPED_METAL_PLATE", parent)
    bore = MeshBatch()
    bore.cylindrical(0, 0, [(.186, .290), (.186, .350)], mats["steel"], 48, True)
    for x in [-.237, .237]:
        for z in [-.237, .237]:
            bore.cylindrical(x, z, [(.030, .299), (.030, .350)], mats["steel"], 16, True)
    cut_mesh(cover, bore.finish("Plate aperture cutter", parent))

    tabs = MeshBatch()
    for z in [-.284, .284]:
        tabs.box((0, .283, z), (.166, .067, .030), mats["steel"], .006)
    for x in [-.237, .237]:
        for z in [-.237, .237]:
            tabs.cylindrical(x, z, [(.028, .331), (.025, .335), (.019, .337)], mats["case"], 16, True)
    tabs.finish("BUTTON_FOLDED_TABS_AND_STAKES", parent)

    terminal_shoulders = MeshBatch()
    for x in [-.292, .292]:
        for z in [-PIN_Z, PIN_Z]:
            terminal_shoulders.box((x, TERMINAL_EXIT_Y, z), (.030, .028, .070), mats["tin"], .004)
    terminal_shoulders.finish("BUTTON_TERMINAL_SHOULDERS", parent)


def plunger(parent, mats):
    knob = MeshBatch()
    top = TOP_Y - PLATE_Y
    knob.cylindrical(0, 0, [(.144, -.068), (.163, -.065), (.173, -.052),
                            (CAP_RADIUS, .069), (.171, .081), (.157, top)], mats["plunger"], 48, True)
    knob.finish("BUTTON_BLACK_PLUNGER", parent)


def native_leads(parent, mats):
    lead = MeshBatch()
    # 0.30 mm stock and 0.70 mm width. The sprung bend reaches 7.7 mm
    # across, before returning to the nominal 6.5 mm through-hole pitch.
    section = ((.290, .099), (.324, .099), (.356, .080), (.385, .039),
               (.366, .014), (.340, -.015), (.340, -LEAD_LENGTH+.016), (.332, -LEAD_LENGTH),
               (.317, -LEAD_LENGTH), (.310, -LEAD_LENGTH+.016), (.310, -.008),
               (.333, .027), (.347, .040), (.334, .057), (.314, .069), (.290, .069))
    for side in [-1, 1]:
        for z in [-PIN_Z, PIN_Z]:
            count = len(section)
            vertices = [(x*side, y, z+offset) for offset in [-.035, .035] for x,y in section]
            faces = [tuple(reversed(range(count))), *loops_faces(count, 2), tuple(range(count, 2*count))]
            lead.add(vertices, faces, mats["tin"])
    lead.finish("BUTTON_NATIVE_SPRUNG_TERMINALS", parent)


def studio(output):
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, -.380, 0), (15, .020, 15), material("Studio ground", "d1dddf", roughness=.73), 0)
    stage.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Diffuse studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.63, .69, .76, 1)
    background.inputs["Strength"].default_value = .42
    focus = (0, .040, 0)
    for name, point, power, size in [("Key", (-1.65, 2.4, 2), 135, 2.2),
                                    ("Fill", (1.8, 1.4, 1.1), 75, 1.8),
                                    ("Edge", (1.1, 2.0, -1.8), 122, 1.6)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = power, "DISK", size
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light, blender_point(focus))
    camera = bpy.data.cameras.new("Tactile switch close-up")
    camera.type, camera.ortho_scale = "ORTHO", 1.42
    view = bpy.data.objects.new("Tactile switch close-up", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((1.8, 1.62, 1.92))
    aim(view, blender_point(focus))
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 860
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key: material(name, color, metal, roughness)
            for key, name, color, metal, roughness in [
                ("case", "Black moulded insulating case", "263034", .02, .54),
                ("steel", "Stamped steel cover", "bdc7ca", .73, .29),
                ("plunger", "Black plunger polymer", "242a2c", .02, .47),
                ("tin", "Tinned stamped contacts", "b9c3c4", .74, .34)]}
    root = empty("BUTTON_COMMON")
    root["Reference"] = "Omron B3F-1000 flat plunger, no ground terminal"
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up, y=0 at seating surface"
    root["Visual scope"] = "Independent exterior model; corners, finish and retaining details are illustrative."
    body, cap, pins = [empty(name) for name in ["BUTTON_BODY", "BUTTON_CAP", "BUTTON_NATIVE_LEADS"]]
    for part in [body, cap, pins]:
        part.parent = root
    cap.location = blender_point((0, PLATE_Y, 0))
    cap["PretravelCm"] = PRETRAVEL
    pins["Mounting pitch"] = "6.5 x 4.5 mm, native; scene may replace with formed breadboard leads"
    housing(body, mats)
    plunger(cap, mats)
    native_leads(pins, mats)
    # The native common terminals run across the 6.5 mm span. Turn that span
    # onto Z so each common pair shares one X side in the teaching mapping.
    body.rotation_euler.z = pins.rotation_euler.z = math.pi / 2
    root["Terminal mapping"] = "Native pair directions follow the drawing; web IDs and formed leads follow the teaching circuit."
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", export_yup=True, export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
