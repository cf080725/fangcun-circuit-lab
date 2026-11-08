"""Build the Omron A6D-4100 flat-actuator DIP switch with Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/dip_switch_a6d.py -- --output dist/models/dip-switch-a6d.glb

The manufacturer drawing supplies case and terminal dimensions. The molded
surface detail and slider travel are visual approximations, modeled as original
geometry. Add --render for a studio PNG with switches 1 and 3 visibly ON.

https://omronfs.omron.com/en_US/ecb/products/pdf/en-a6d_a6dr.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://omronfs.omron.com/en_US/ecb/products/pdf/en-a6d_a6dr.pdf"
WIDTH, DEPTH = 1.220, .660
BOTTOM, TOP = .100, .440
PIN_ROW, PIN_PITCH, TAIL = .381, .254, -.360
SLIDER_OFF, SLIDER_TRAVEL, SLIDER_PIVOT_Y = .070, .140, .415
POLES = tuple((index - 1.5) * PIN_PITCH for index in range(4))


def molded_case(parent, lid, lower, well, ink):
    base = MeshBatch()
    base.loft([(BOTTOM, 1.188, .630, .052), (.121, WIDTH, DEPTH, .060),
               (.317, WIDTH, DEPTH, .060), (.335, 1.204, .648, .058)], lower)
    base.finish("A6D_SEALED_BASE", parent)

    seam = MeshBatch()
    seam.loft([(.331, 1.203, .647, .057), (.346, 1.203, .647, .057)], well)
    seam.finish("A6D_CASE_SEAM", parent)

    cover = MeshBatch()
    cover.loft([(.342, 1.204, .648, .058), (.355, WIDTH, DEPTH, .060),
                (.426, WIDTH, DEPTH, .060), (TOP, 1.201, .641, .052)], lid)
    cover = cover.finish("A6D_RECESSED_COVER", parent)
    for number, x in enumerate(POLES, 1):
        # Molded apertures widen at the top and expose a recessed slider track.
        cutout = MeshBatch()
        cutout.loft([(.330, .116, .356, .006), (.422, .116, .356, .006),
                     (TOP, .143, .386, .009), (.475, .143, .386, .009)], lid, (x, 0))
        cutter = cutout.finish("Track cutout")
        cut_mesh(cover, cutter)

        bed = MeshBatch()
        bed.box((x, .336, 0), (.115, .014, .352), well, .005)
        bed.finish(f"A6D_TRACK_{number}", parent)
        mark(parent, f"A6D_INDEX_{number}", str(number), x, .260, .108, ink)
    mark(parent, "A6D_ON_MARK", "ON", POLES[0], -.251, .105, ink)


def mark(parent, name, label, x, z, size, ink):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = label
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.resolution_u = 4
    curve.materials.append(ink)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = blender_point((x, TOP + .0005, z))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")


def sliders(parent, ivory, grip):
    nodes = []
    for number, x in enumerate(POLES, 1):
        pivot = empty(f"A6D_SLIDER_{number}")
        pivot.parent = parent
        pivot.location = blender_point((x, SLIDER_PIVOT_Y, SLIDER_OFF))
        pivot["Pole"] = number
        pivot["Travel toward ON in +Y-up coordinates"] = [0., 0., -SLIDER_TRAVEL]
        shape = MeshBatch()
        shape.box((0, -.034, 0), (.102, .024, .165), ivory, .004)
        shape.box((0, -.004, 0), (.105, .029, .095), ivory, .006)
        # Fine raised transverse grip bars are part of the moving actuator.
        for z in (-.024, .024):
            shape.box((0, .011, z), (.085, .010, .009), grip, .002)
        shape.finish(f"A6D_SLIDER_CAP_{number}", pivot)
        nodes.append(pivot)
    return nodes


def terminals(parent, alloy):
    group = empty("A6D_NATIVE_LEADS")
    group.parent = parent
    for index, x in enumerate(POLES):
        for sign, number in ((1, index + 1), (-1, 8 - index)):
            # Stamped T shape, neck, formed shoulder, and small clipped tip bevel.
            # The shank is nominally straight at the PCB grid (90° tolerance limit).
            sections = [(TAIL, .028, .015, PIN_ROW, 0),
                        (TAIL + .013, .050, .025, PIN_ROW, 0),
                        (-.003, .050, .025, PIN_ROW, 0), (0, .112, .025, PIN_ROW, 0),
                        (.007, .120, .025, PIN_ROW, 0), (.163, .120, .025, PIN_ROW, 0),
                        (.180, .113, .025, .371, math.pi/4),
                        (.193, .104, .025, .351, math.pi/2),
                        (.193, .098, .023, .312, math.pi/2)]
            corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            points = [(x + side * width/2, y + sign * front * thickness/2 * math.sin(bend),
                       sign * z + front * thickness/2 * math.cos(bend))
                      for y, width, thickness, z, bend in sections for side, front in corners]
            last = len(points)
            faces = [(3, 2, 1, 0), *loops_faces(4, len(sections)),
                     (last-4, last-3, last-2, last-1)]
            lead = MeshBatch()
            lead.add(points, faces, alloy)
            mesh = lead.finish(f"A6D_LEAD_{number}", group)
            mesh["Physical pin"] = number
            mesh["Endpoint"] = [x, 0., sign * PIN_ROW]


def studio():
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, TAIL-.035, 0), (28, .055, 28), material("Studio ground", "a6bac4", 0, .77), 0)
    stage.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Softbox sky")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.62, .71, .84, 1)
    sky.inputs["Strength"].default_value = .32
    focus = blender_point((0, .05, 0))
    for name, point, power, size in [("Key", (-2.2, 2.5, 2.1), 92, 2.65),
                                     ("Fill", (2.5, 1.8, 2.0), 48, 2.05),
                                     ("Edge", (1.4, 2.3, -2.3), 69, 2.10)]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.shape, light.size = power, "DISK", size
        source = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(source)
        source.location = blender_point(point)
        aim(source, focus)
    camera = bpy.data.cameras.new("DIP switch close-up")
    camera.type, camera.ortho_scale = "ORTHO", 1.60
    view = bpy.data.objects.new("DIP switch close-up", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((.95, 1.28, 2.63))
    aim(view, focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1050, 800
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)

    lid = material("Charcoal molded top", "27292c", 0, .33)
    lower = material("Black molded housing", "202125", 0, .38)
    well = material("Recessed guides", "131416", 0, .50)
    ivory = material("Off-white actuator", "e7e2cf", 0, .33)
    grip = material("Actuator grip", "eeeadb", 0, .38)
    ink = material("White position legends", "f1efea", 0, .62)
    alloy = material("Solderable lead frame", "b5b8b6", .72, .26)
    root = empty("A6D_COMMON")
    root["Manufacturer part"] = "Omron A6D-4100"
    root["Manufacturer drawing"] = DATASHEET
    root["Axes"] = "Numeric centimetres. +Y face up. Y=0 PCB seating datum. ON is -Z."
    root["Nominal width x depth x overall height in mm"] = [12.2, 6.6, 8.0]
    root["Pin layout"] = "+Z row 1/2/3/4, -Z row 8/7/6/5 in +X order"
    root["Visual approximations"] = "Molding details, finish, slider travel. Straight nominal tails."
    body = empty("A6D_BODY")
    body.parent = root
    molded_case(body, lid, lower, well, ink)
    moving = sliders(root, ivory, grip)
    terminals(root, alloy)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_yup=True, export_extras=True)
    if args.render:
        scene = studio()
        for slider in moving[::2]:
            slider.location.y += SLIDER_TRAVEL
        args.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
