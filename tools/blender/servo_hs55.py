"""Create an HS-55 exterior and moving horn in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/servo_hs55.py -- --output dist/models/servo-hs55.glb

Use --render for a studio PNG. The Hitec sheet supplies the case, seating,
mounting and spline dimensions. Horn accessory shape, seam and fastener
finishes are visual approximations. No vendor artwork or CAD mesh is used.

The GLB uses numeric centimetres with +Y up, origin at the base center and
cable outlet on +Z. The horn points +X in its 90-degree neutral position.
The lab supplies its own cable to the unchanged teaching endpoints.

https://www.hiteccs.com/public/uploads/data_sheet/HCS_HS-55_Specsheetv2.2_1026-1729887855.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://www.hiteccs.com/public/uploads/data_sheet/HCS_HS-55_Specsheetv2.2_1026-1729887855.pdf"
WIDTH, LENGTH, TOP = 1.16, 2.28, 2.40
LOW_TOP, AXIS_Z = 2.08, .53
EAR_BOTTOM, EAR_TOP, EAR_SPAN, EAR_CENTER, EAR_BORE = 1.67, 1.77, 3.26, 1.43, .10


def lower_case(parent, mats):
    case = MeshBatch()
    case.loft([(0, 1.095, 2.205, .066), (.042, WIDTH, LENGTH, .073),
               (.273, WIDTH, LENGTH, .072), (.300, 1.126, 2.246, .066)], mats["base"])
    case.loft([(.307, 1.124, 2.242, .062), (.322, WIDTH, LENGTH, .069),
               (1.601, WIDTH, LENGTH, .073), (1.626, 1.133, 2.249, .065)], mats["case"])
    case.loft([(1.631, 1.128, 2.246, .067), (1.649, WIDTH, LENGTH, .074),
               (2.045, WIDTH, LENGTH, .074), (LOW_TOP, 1.120, 2.238, .066)], mats["lid"])
    case.finish("SERVO_STACKED_HOUSING", parent)

    ears = MeshBatch()
    bores = MeshBatch()
    for sign in [-1, 1]:
        center = (0, sign*1.355)
        ears.loft([(EAR_BOTTOM, 1.112, .520, .083), (EAR_BOTTOM+.017, WIDTH, .550, .092),
                   (EAR_TOP-.013, WIDTH, .550, .092), (EAR_TOP, 1.123, .524, .082)], mats["lid"], center)
        bores.cylindrical(0, sign*EAR_CENTER, [(EAR_BORE, 1.62), (EAR_BORE, 1.82)], mats["lid"], 32, True)
    mounting = ears.finish("SERVO_MOUNTING_EARS", parent)
    cut_mesh(mounting, bores.finish("Mounting drill cutter", parent))

    cable = MeshBatch()
    cable.box((0, .351, 1.133), (.383, .203, .124), mats["seal"], .043)
    cable.box((0, .351, 1.175), (.299, .148, .064), mats["seal"], .022)
    for x in [-.074, 0, .074]:
        cable.box((x, .351, 1.208), (.049, .066, .009), mats["shadow"], .009)
    cable.finish("SERVO_CABLE_STRAIN_RELIEF", parent)


def upper_case(parent, mats):
    gears = MeshBatch()
    gears.loft([(LOW_TOP-.003, 1.110, 1.405, .240), (2.117, 1.147, 1.428, .250),
                (2.337, 1.145, 1.427, .249), (2.367, 1.092, 1.383, .237)], mats["lid"], (0, .402))
    gears.cylindrical(0, AXIS_Z, [(.385, 2.349), (.382, 2.373), (.358, 2.387)], mats["case"], 44, True)
    gears.cylindrical(0, AXIS_Z, [(.304, 2.377), (.295, TOP)], mats["seal"], 40, True)
    gears.cylindrical(0, -.124, [(.225, 2.339), (.219, 2.376), (.185, 2.393)], mats["lid"], 36, True)
    gears.finish("SERVO_GEAR_CASE_AND_BEARINGS", parent)

    fasteners = MeshBatch()
    for x in [-.430, .430]:
        for z in [-.960, .960]:
            fasteners.cylindrical(x, z, [(.064, .002), (.079, .017), (.069, .038)], mats["steel"], 18, True)
            fasteners.box((x, .001, z), (.108, .003, .017), mats["shadow"], 0)
            fasteners.box((x, .001, z), (.017, .003, .108), mats["shadow"], 0)
    fasteners.finish("SERVO_BASE_FASTENERS", parent)

    label = MeshBatch()
    label.box((0, LOW_TOP+.001, -.754), (.850, .003, .494), mats["label"], .027)
    label.box((0, LOW_TOP+.003, -.574), (.800, .003, .045), mats["rule"], .008)
    label.finish("SERVO_MODEL_LABEL", parent)
    text = bpy.data.curves.new("HS-55 model designation", "FONT")
    text.body, text.align_x, text.align_y, text.size = "HS-55", "CENTER", "CENTER", .216
    text.materials.append(mats["ink"])
    obj = bpy.data.objects.new("SERVO_MODEL_DESIGNATION", text)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = blender_point((0, LOW_TOP+.005, -.780))
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)


def make_spline(parent, mats):
    tooth_count = 15
    loops = [(0, .160, .160), (.020, .176, .176), (.043, .177, .200),
             (.251, .177, .200), (.270, .174, .183)]
    count = 4 * tooth_count
    vertices = [(radius*math.cos(angle), y, radius*math.sin(angle))
                for y, valley, peak in loops for tooth in range(tooth_count)
                for phase, radius in [(0, valley), (.24, peak), (.65, peak), (.85, valley)]
                for angle in [(tooth+phase)*math.tau/tooth_count]]
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(loops)),
             tuple(range(len(vertices)-count, len(vertices)))]
    spline = MeshBatch()
    spline.add(vertices, faces, mats["spline"])
    spline.finish("SERVO_15T_SPLINE", parent)


def make_horn(parent, mats):
    # A compact one-arm accessory with a rounded hub and three linkage bores.
    outline = [(offset + radius*math.cos(angle), radius*math.sin(angle))
               for offset, radius, start in [(0, .272, math.pi/2), (1.02, .116, -math.pi/2)]
               for step in range(17) for angle in [start+step*math.pi/16]]
    sections = [(.269, .94), (.281, 1), (.349, 1), (.362, .94)]
    vertices = [(x*scale, y, z*scale) for y, scale in sections for x,z in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(sections)),
             tuple(range(len(vertices)-count, len(vertices)))]
    plate = MeshBatch()
    plate.add(vertices, faces, mats["horn"])
    arm = plate.finish("SERVO_HORN_ARM", parent)
    bores = MeshBatch()
    for x in [.415, .655, .895]:
        bores.cylindrical(x, 0, [(.053, .25), (.053, .380)], mats["horn"], 24, True)
    cut_mesh(arm, bores.finish("Horn linkage drill cutter", parent))

    hub = MeshBatch()
    hub.cylindrical(0, 0, [(.210, .092), (.245, .111), (.250, .275),
                           (.229, .335), (.194, .355)], mats["horn"], 48, True)
    hub.finish("SERVO_HORN_HUB", parent)

    screw = MeshBatch()
    screw.cylindrical(0, 0, [(.079, .346), (.098, .356), (.098, .369), (.082, .380)], mats["steel"], 32, True)
    head = screw.finish("SERVO_HORN_SCREW", parent)
    for width,depth in [(.128,.025),(.025,.128)]:
        slot = MeshBatch()
        slot.box((0, .383, 0), (width, .026, depth), mats["steel"], 0)
        cut_mesh(head, slot.finish("Fastener recess cutter", parent))


def studio(output):
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, -.023, 0), (30, .030, 30), material("Studio ground", "cfdbdf", roughness=.72), 0)
    stage.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.56, .64, .75, 1)
    background.inputs["Strength"].default_value = .48
    focus = (0, 1.23, 0)
    for name, point, power, size in [("Key", (3, 5.4, -4), 440, 5),
                                    ("Fill", (-3, 3.8, -2.7), 270, 4),
                                    ("Edge", (1, 4.2, 4.0), 365, 3)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = power, "DISK", size
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light, blender_point(focus))
    camera = bpy.data.cameras.new("HS-55 studio view")
    camera.type, camera.ortho_scale = "ORTHO", 4.75
    view = bpy.data.objects.new("HS-55 studio view", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((6.2, 6.8, -4.8))
    aim(view, blender_point(focus))
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 900
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
                ("base", "Lower graphite case", "22272a", .03, .56),
                ("case", "Molded engineering plastic", "2c3136", .03, .46),
                ("lid", "Graphite gear case and mounting ears", "34383c", .02, .42),
                ("seal", "Dark collar and cable boot", "1e2227", 0, .58),
                ("shadow", "Fastener and cable recesses", "11151a", .06, .58),
                ("steel", "Steel fasteners", "afb6bb", .80, .30),
                ("spline", "Resin 15T output spline", "6d716d", .01, .47),
                ("horn", "Dark nylon one-arm horn", "3a3d3f", .01, .48),
                ("label", "Original teaching label artwork", "24272b", 0, .62),
                ("rule", "Teaching label accent", "a43839", 0, .59),
                ("ink", "Model designation ink", "e0e3de", 0, .64)]}
    root = empty("SERVO_COMMON")
    root["Reference"] = "Hitec HS-55 mechanical dimensions"
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up, origin at case base center, cable toward +Z"
    root["Visual scope"] = "Independent exterior reconstruction. Horn shape, fastener details, and labeling are illustrative."
    body, moving = empty("SERVO_BODY"), empty("SERVO_HORN")
    body.parent = moving.parent = root
    moving.location = blender_point((0, TOP, AXIS_Z))
    moving["Neutral"] = "90-degree servo angle, horn pointing +X"
    lower_case(body, mats)
    upper_case(body, mats)
    make_spline(moving, mats)
    make_horn(moving, mats)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", export_yup=True, export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
