"""Build the finger-adjust trimmer with Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/potentiometer_3362.py -- --output dist/models/potentiometer-3362.glb

Use --blend for the editable file or --render for a PNG. Dimensions follow
the current Bourns 3362P finger-adjust drawing. Resin colors, corner radii,
the housing seam, and the angle marker are illustrative. No vendor meshes,
markings, or textures are used.

The GLB uses numeric centimetres and +Y up. Rotate POT_ROTOR about its local
Y axis. The lab supplies teaching leads to its unchanged VCC/OUT/GND contacts.
The Blender-only preview includes separate reference pins at native locations.

https://www.bourns.com/docs/product-datasheets/3362.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://www.bourns.com/docs/product-datasheets/3362.pdf"
WIDTH, DEPTH, FRONT = .660, .699, .384
BODY_HEIGHT, KNOB_HEIGHT, KNOB_RADIUS = .488, .993, .250
LEAD_RADIUS, LEAD_LENGTH = .023, .546
PIN_LOCATIONS = ((3, -.254, .031), (2, 0, -.223), (1, .254, .031))


def housing(parent, mats):
    center = (0, FRONT - DEPTH / 2)
    shell = MeshBatch()
    shell.loft([(.028, .632, .671, .044), (.066, WIDTH, DEPTH, .043),
                (.442, WIDTH, DEPTH, .044), (.478, .632, .671, .035)],
               mats["shell"], center)
    shell.finish("POT_MOLDED_HOUSING", parent)

    base = MeshBatch()
    base.box((0, .038, center[1]), (.578, .046, .607), mats["seal"], .012)
    for x in [-.269, .269]:
        for z in [-.251, .323]:
            base.box((x, .024, z), (.093, .048, .075), mats["shell"], .011)
    for _, x, z in PIN_LOCATIONS:
        base.cylindrical(x, z, [(.040, .013), (.036, .033), (.028, .047)], mats["socket"], 20, True)
    base.finish("POT_BASE_SEAL_AND_EGRESS", parent)

    collar = MeshBatch()
    collar.cylindrical(0, 0, [(.246, .477), (.246, .483), (.235, BODY_HEIGHT), (.177, BODY_HEIGHT),
                              (.175, .481), (.177, .477), (.246, .477)], mats["seal"], 48)
    collar.finish("POT_FIXED_BEARING_RING", parent)


def rotor(parent, mats):
    grip = MeshBatch()
    teeth = 32
    profile = ((-.003, .179, .179), (.045, .225, .225),
               (.083, KNOB_RADIUS, .237), (.954, KNOB_RADIUS, .237),
               (.975, .242, .238), (KNOB_HEIGHT, .228, .228))
    points_per_ring = teeth * 4
    vertices = [
        (radius * math.cos(angle), y, radius * math.sin(angle))
        for y, crest, groove in profile
        for tooth in range(teeth)
        for phase, radius in [(0, groove), (.22, crest), (.57, crest), (.80, groove)]
        for angle in [(tooth + phase) * math.tau / teeth]
    ]
    faces = loops_faces(points_per_ring, len(profile))
    faces.extend([tuple(reversed(range(points_per_ring))),
                  tuple(range(len(vertices) - points_per_ring, len(vertices)))])
    grip.add(vertices, faces, mats["knob"])
    knob = grip.finish("POT_KNURLED_KNOB", parent)

    slot = MeshBatch()
    slot.box((0, KNOB_HEIGHT - .040, 0), (.400, .120, .060), mats["knob"], 0)
    cutter = slot.finish("Driver slot cutter", parent)
    cut_mesh(knob, cutter)

    marker = MeshBatch()
    marker.add([(-.051, KNOB_HEIGHT+.0002, .079), (0, KNOB_HEIGHT+.0002, .190),
                (.051, KNOB_HEIGHT+.0002, .079)], [(0, 1, 2)], mats["index"])
    marker.finish("POT_ANGLE_MARKER", parent, closed=False)


def reference_pins(mats):
    pins = MeshBatch()
    for _, x, z in PIN_LOCATIONS:
        pins.cylindrical(x, z, [(.016, -LEAD_LENGTH), (LEAD_RADIUS, -LEAD_LENGTH+.015),
                                 (LEAD_RADIUS, .022)], mats["tin"], 20, True)
    obj = pins.finish("Reference only • native Ø0.46 mm terminals")
    obj["Excluded from web asset"] = "The workbench draws its own formed teaching leads."


def studio():
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, -.587, 0), (20, .020, 20), material("Studio ground", "c8d7db", roughness=.78), 0)
    stage.finish("Studio ground").hide_set(True)
    scene.world = bpy.data.worlds.new("Soft studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.56, .66, .73, 1)
    background.inputs["Strength"].default_value = .38
    focus = (0, .456, .015)
    for name, point, power, size in [("Soft key", (-3, 4.2, 3), 270, 4),
                                    ("Fill", (3.3, 2.2, 2.5), 165, 3),
                                    ("Edge", (1.3, 3, -3), 230, 2.7)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = power, "DISK", size
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light, blender_point(focus))
        light.hide_set(True)
    camera = bpy.data.cameras.new("Trimmer close-up")
    camera.type, camera.ortho_scale = "ORTHO", 2.75
    view = bpy.data.objects.new("Trimmer close-up", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((2.35, 3.6, 4.2))
    aim(view, blender_point(focus))
    scene.camera = view
    view.hide_set(True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.region_3d.view_location = Vector(blender_point(focus))
                space.region_3d.view_rotation = view.rotation_euler.to_quaternion()
                space.region_3d.view_distance = 2.8
                space.region_3d.view_perspective = "ORTHO"
                space.shading.color_type = "MATERIAL"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--blend", type=Path)
    parser.add_argument("--render", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key: material(name, color, metal, roughness)
            for key, name, color, metal, roughness in [
                ("shell", "Molded blue housing", "276080", .02, .42),
                ("seal", "Insulating base and rotor collar", "213c4a", .03, .58),
                ("socket", "Native terminal recess", "79908f", .48, .46),
                ("knob", "Light gray finger adjuster", "d4d9d3", .02, .38),
                ("index", "Teaching angle index", "334951", 0, .64),
                ("tin", "Tin-plated native terminals", "c0c6ca", .80, .29)]}
    root = empty("POT_COMMON")
    root["Reference"] = "Bourns 3362P-1-103TLF finger-adjust dimensions"
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up"
    root["Visual scope"] = "Independently modeled exterior; colors, seams and angle index are illustrative."
    body = empty("POT_BODY")
    body.parent = root
    moving = empty("POT_ROTOR")
    moving.parent = root
    moving.location = blender_point((0, BODY_HEIGHT, 0))
    moving["Travel"] = "270 degrees nominal mechanical; 240 degrees nominal adjustment"
    housing(body, mats)
    rotor(moving, mats)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_yup=True, export_extras=True)
    if args.blend or args.render:
        reference_pins(mats)
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
