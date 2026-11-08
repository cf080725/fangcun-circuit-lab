"""Build the Bourns PEC11R-4220F-S0024 exterior in Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/encoder_pec11r.py -- --output dist/models/encoder-pec11r.glb

The manufacturer's rear-facing 4xxxF-S drawing and flattened shaft table
give the shell, panel hardware, shaft and terminal dimensions. Case seams,
stamping details and finish are interpreted. No vendor meshes or textures
are included. Use --render for the studio view or --blend for editable geometry.

https://www.bourns.com/data/global/pdfs/PEC11R.pdf
https://www.bourns.com/resources/design-tools/design-kits/encoders
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, empty, loops_faces, material


DATASHEET = "https://www.bourns.com/data/global/pdfs/PEC11R.pdf"
KIT = "https://www.bourns.com/resources/design-tools/design-kits/encoders"
SHELL_WIDTH, SHELL_DEPTH = 1.250, 1.340
REAR = .390
PANEL = REAR + .650
BUSHING_LENGTH, BUSHING_PITCH = .700, .075
SHAFT_LENGTH, SHAFT_RADIUS, FLAT_LENGTH = 2.000, .300, 1.000
SWITCH_STROKE, TERMINAL_Y = .050, .075
TERMINALS = {
    "A": (-.250, .750), "C": (0, .750), "B": (.250, .750),
    "SW1": (-.250, -.700), "SW2": (.250, -.700),
}


def capped_rings(batch, rings, mat):
    count = len(rings[0])
    end = count * len(rings)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(rings)),
             tuple(range(end - count, end))]
    batch.add([point for ring in rings for point in ring], faces, mat)


def case(parent, mats):
    back = MeshBatch()
    back.loft([(REAR, 1.124, 1.213, .062), (.412, 1.198, 1.276, .066),
               (.758, 1.204, 1.282, .066), (.849, 1.207, 1.282, .062)], mats["phenolic"])
    back.box((0, .423, 0), (.898, .066, .981), mats["base"], .019)
    for x, z in TERMINALS.values():
        edge = math.copysign(.617, z)
        back.box((x, .480, edge), (.142, .150, .112), mats["base"], .013)
        back.box((x, .637, edge), (.148, .160, .086), mats["phenolic"], .007)
    for x in (-.48, .48):
        back.box((x, .526, 0), (.210, .106, .278), mats["base"], .012)
    back.finish("ENCODER_PHENOLIC_BASE", parent)

    steel = MeshBatch()
    steel.loft([(.797, 1.212, 1.296, .072), (.825, SHELL_WIDTH, SHELL_DEPTH, .074),
                (1.015, SHELL_WIDTH, SHELL_DEPTH, .074), (PANEL, 1.210, 1.300, .058)],
               mats["case"])
    for x in (-.469, .469):
        for z in (-.506, .506):
            steel.cylindrical(x, z, [(.046, PANEL-.002), (.044, PANEL+.010),
                                     (.032, PANEL+.020)], mats["stamp"], 18, True)
            steel.box((x, .721, math.copysign(.624, z)), (.128, .246, .074), mats["case"], .009)
    for x in (-.594, .594):
        for z in (-.331, .331):
            steel.box((x, .713, z), (.059, .302, .221), mats["case"], .011)
    steel.finish("ENCODER_STAMPED_STEEL_CASE", parent)


def terminals(parent, mats):
    for signal, (x, z) in TERMINALS.items():
        sign = math.copysign(1, z)
        profile = [(.039, z, .026), (.062, z, .040), (.444, z, .040),
                   (.486, z-sign*.010, .040), (.546, z-sign*.069, .040),
                   (.582, z-sign*.108, .049), (.675, z-sign*.122, .049)]
        batch = MeshBatch()
        rings = [[(x+dx, y, center+dz) for dx, dz in [(-width, -.015), (width, -.015),
                                                       (width, .015), (-width, .015)]]
                 for y, center, width in profile]
        capped_rings(batch, rings, mats["tin"])
        contact = batch.finish(f"ENCODER_CONTACT_{signal}", parent)
        contact["Endpoint"] = [x, TERMINAL_Y, z]

    ears = MeshBatch()
    for side in (-1, 1):
        profile = [(.058, .660, .084), (.093, .660, .130), (.289, .680, .130),
                   (.350, .685, .130), (.422, .659, .130), (.647, .655, .134),
                   (.851, .621, .150), (.903, .620, .160)]
        rings = [[(side * (x+dx), y, z) for dx, z in [(-.015, -half_width), (.015, -half_width),
                                                        (.015, half_width), (-.015, half_width)]]
                 for y, x, half_width in profile]
        capped_rings(ears, rings, mats["case"])
    ears.finish("ENCODER_TWO_MOUNTING_EARS", parent)


def panel_hardware(parent, mats):
    bore = .304
    bushing = MeshBatch()
    bushing.cylindrical(0, 0, [(bore, PANEL), (.377, PANEL), (.378, PANEL+.045),
                              (.317, PANEL+.084), (.317, PANEL+.670),
                              (.311, PANEL+BUSHING_LENGTH), (bore, PANEL+BUSHING_LENGTH),
                              (bore, PANEL)], mats["thread"], 64)
    bushing.finish("ENCODER_BUSHING_M7", parent)

    # One right-handed helical crest swept along the actual 0.75 mm pitch.
    ridge = MeshBatch()
    start, end = PANEL+.092, PANEL+.672
    count = math.ceil((end-start)/BUSHING_PITCH*40)
    rings = []
    for i in range(count+1):
        y = start + (end-start)*i/count
        angle = -(y-start)*math.tau/BUSHING_PITCH
        peak = .314 + .036 * min(1, i/10, (count-i)/10)
        section = [(.314, -.025), (peak, -.007), (peak, .007), (.314, .025)]
        rings.append([(radius*math.cos(angle), y+offset, radius*math.sin(angle))
                      for radius, offset in section])
    capped_rings(ridge, rings, mats["thread"])
    ridge.finish("ENCODER_HELICAL_THREAD_M7_X_075", parent)

    washer = MeshBatch()
    washer.cylindrical(0, 0, [(.355, 1.080), (.593, 1.080), (.600, 1.087), (.600, 1.123),
                             (.593, 1.130), (.355, 1.130), (.355, 1.080)], mats["case"], 64)
    washer.finish("ENCODER_PANEL_WASHER", parent)

    nut = MeshBatch()
    ring_count = 60
    outer = .500/math.cos(math.pi/6)
    section = [(outer*.94, 1.130, True), (outer, 1.153, True), (outer, 1.307, True),
               (outer*.94, 1.330, True), (.354, 1.330, False), (.354, 1.130, False),
               (outer*.94, 1.130, True)]
    vertices = []
    for radius, y, hexagonal in section:
        for i in range(ring_count):
            angle = i*math.tau/ring_count
            apothem = math.cos(math.pi/6)
            sector = angle % (math.pi/3) - math.pi/6
            r = radius*apothem/math.cos(sector) if hexagonal else radius
            vertices.append((r*math.cos(angle), y, r*math.sin(angle)))
    nut.add(vertices, loops_faces(ring_count, len(section)), mats["nut"])
    nut.finish("ENCODER_HEX_PANEL_NUT", parent)


def shaft(parent, mats):
    turning = MeshBatch()
    flat_start = SHAFT_LENGTH-FLAT_LENGTH
    profile = [(.595, .277, None), (.620, SHAFT_RADIUS, None),
               (flat_start-.013, SHAFT_RADIUS, None),
               (flat_start+.005, SHAFT_RADIUS, .150),
               (SHAFT_LENGTH-.047, SHAFT_RADIUS, .150), (SHAFT_LENGTH, .253, .116)]
    rings = []
    for y, radius, flat in profile:
        ring = []
        for i in range(96):
            angle = i*math.tau/96
            x, z = radius*math.cos(angle), radius*math.sin(angle)
            ring.append((x, y, z if flat is None else min(z, flat)))
        rings.append(ring)
    capped_rings(turning, rings, mats["shaft"])
    turning.finish("ENCODER_6MM_D_SHAFT", parent)


def studio():
    scene = bpy.context.scene
    ground = MeshBatch()
    ground.box((0, .005, 0), (30, .030, 30), material("Studio background", "dbe6e7", 0, .80), 0)
    ground.finish("Studio background")
    scene.world = bpy.data.worlds.new("Studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.66, .74, .78, 1)
    background.inputs["Strength"].default_value = .38
    focus = blender_point((0, 1.51, .02))
    for name, position, power, size in [("Key", (-4.4, 5.0, 4.1), 440, 5.1),
                                        ("Fill", (4.6, 3.9, 2.6), 285, 3.8),
                                        ("Edge", (1.0, 4.2, -4.0), 420, 3.4)]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.shape, light.size = power, "DISK", size
        obj = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(position)
        aim(obj, focus)
    camera = bpy.data.cameras.new("Encoder studio")
    camera.type, camera.ortho_scale = "ORTHO", 3.62
    view = bpy.data.objects.new("Encoder studio", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((2.28, 3.31, 5.42))
    aim(view, focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 760, 880
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render", type=Path)
    parser.add_argument("--blend", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key: material(name, color, metallic, roughness)
            for key, name, color, metallic, roughness in [
                ("phenolic", "Dark phenolic moulding", "252922", .02, .56),
                ("base", "Recessed rear insulator", "171914", .01, .64),
                ("case", "Stamped nickel-plated steel", "bec4be", .82, .31),
                ("stamp", "Formed steel rivet", "a2aaa4", .85, .37),
                ("thread", "Zinc-plated threaded bushing", "9ea9a3", .86, .34),
                ("nut", "Nickel-plated mounting nut", "b8c0bb", .87, .28),
                ("shaft", "Machined steel shaft", "c4c7c0", .79, .27),
                ("tin", "Tin-plated solder terminal", "b5bfc0", .72, .33),
            ]}
    root = empty("ENCODER_COMMON")
    root["Manufacturer part"] = "Bourns PEC11R-4220F-S0024"
    root["Manufacturer drawing"] = DATASHEET
    root["Design kit H-832-2"] = KIT
    root["Axes"] = "Centimetres. +Y is shaft up, +Z is the A/C/B contact row."
    root["Visual scope"] = "Independently modeled exterior. Stamping, finish and seam detail are interpreted."
    body = empty("ENCODER_BODY")
    body.parent = root
    moving = empty("ENCODER_SHAFT")
    moving.parent = root
    moving.location = blender_point((0, PANEL, 0))
    moving["Detents per turn"] = 24
    moving["Pulses per turn"] = 24
    moving["Press displacement Y"] = -SWITCH_STROKE
    case(body, mats)
    terminals(body, mats)
    panel_hardware(body, mats)
    shaft(moving, mats)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_yup=True, export_extras=True)
    if args.render or args.blend:
        scene = studio()
    if args.blend:
        args.blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()), compress=True)
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
