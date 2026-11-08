"""Build a single-digit SC56-11EWA display in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/sevenseg_sc56.py -- --output dist/models/sevenseg-sc56.glb

Add --render for a studio PNG. The 12.7 × 19.05 × 8 mm envelope, 14.22 mm
digit height, 8° skew, 1.5 mm decimal point, and front pin map reference the
Kingbright drawing. Bezel, epoxy and lead finishes are visual approximations.
The model is independently drawn and uses no vendor meshes or artwork.

Numeric coordinates are centimetres with +Y up, digit top −Z, seating plane
y=0, and pin 1 at the left of the front bottom edge. The eight individual
Segment_* meshes let the workbench apply live lighting per segment.

https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf"
WIDTH, LENGTH, FACE_Y = 1.270, 1.905, .800
PIN_PITCH, PIN_ROW = .254, .762
PIN_LENGTH, PIN_EGRESS, PIN_RADIUS = .400, .120, .025
DOT_X, DOT_Z, DOT_RADIUS = .503, .625, .075
SKEW = math.tan(math.radians(8))


def outline_prism(batch, outline, layers, mat):
    cx = sum(x for x, _ in outline)/len(outline)
    cz = sum(z for _, z in outline)/len(outline)
    points = [(cx+(x-cx)*scale, y, cz+(z-cz)*scale)
              for y, scale in layers for x, z in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(layers)),
             tuple(range(len(points)-count, len(points)))]
    batch.add(points, faces, mat)


def digit_outlines():
    top = [(-.249, -.711), (.252, -.711), (.259, -.697), (.251, -.603),
           (-.253, -.603), (-.262, -.617), (-.259, -.697)]
    mid = [(-.295, 0), (-.244, -.062), (.241, -.062), (.295, 0),
           (.243, .063), (-.244, .063)]
    upright = [(-.351, -.711), (-.306, -.711), (-.300, -.083), (-.329, -.019),
               (-.421, -.019), (-.427, -.096), (-.424, -.614), (-.407, -.678), (-.380, -.704)]
    return {name:[(x - SKEW*z - .017, z) for x,z in outline] for name,outline in {
        "a":top, "b":[(-x,z) for x,z in upright],
        "c":[(-x,-z) for x,z in upright], "d":[(x,-z) for x,z in top],
        "e":[(x,-z) for x,z in upright], "f":upright, "g":mid}.items()}


def case(parent, mats, outlines):
    frame = MeshBatch()
    frame.loft([(PIN_EGRESS, 1.204, 1.837, .032), (.148, WIDTH, LENGTH, .042),
                (.700, WIDTH, LENGTH, .042), (.748, 1.247, 1.881, .036)], mats["case"])
    for sign in [-1, 1]:
        frame.loft([(0, 1.183, .109, .019), (.032, 1.247, .142, .026),
                    (.143, 1.248, .146, .027)], mats["case"], (0, sign*.878))
        frame.box((sign*.581, .073, 0), (.092, .140, 1.751), mats["case"], .017)
    frame.finish("SC56_MOLDED_CASE_AND_STANDOFFS", parent)

    underside = MeshBatch()
    underside.box((0, .122, 0), (1.087, .028, 1.685), mats["epoxy"], .024)
    for z in [-PIN_ROW,PIN_ROW]:
        for col in range(-2,3):
            underside.cylindrical(col*PIN_PITCH, z, [(.052, .099), (.058, .113), (.047, .136)],
                                   mats["collar"], 14, True)
    underside.finish("SC56_UNDERSIDE_INSERT", parent)

    bezel = MeshBatch()
    bezel.loft([(.718, 1.246, 1.881, .037), (.734, WIDTH, LENGTH, .042),
                (.780, WIDTH, LENGTH, .040), (FACE_Y, 1.251, 1.887, .037)], mats["face"])
    plate = bezel.finish("SC56_GRAY_FACE", parent)
    punches = MeshBatch()
    for outline in outlines.values():
        outline_prism(punches, outline, [(.709, 1.045), (.816, 1.045)], mats["face"])
    punches.cylindrical(DOT_X, DOT_Z, [(DOT_RADIUS+.003, .709), (DOT_RADIUS+.003, .816)],
                        mats["face"], 36, True)
    cut_mesh(plate, punches.finish("Optical aperture cutter", parent))


def lenses(parent, mats, outlines):
    for name, outline in outlines.items():
        lens = MeshBatch()
        outline_prism(lens, outline, [(.728, .982), (.746, 1), (.785, 1), (.797, .955)], mats["lens"])
        lens.finish("Segment_"+name, parent)
    decimal = MeshBatch()
    decimal.cylindrical(DOT_X, DOT_Z, [(DOT_RADIUS-.003, .728), (DOT_RADIUS, .747),
                                     (DOT_RADIUS, .785), (DOT_RADIUS-.003, .797)], mats["lens"], 36, True)
    decimal.finish("Segment_dp", parent)


def leads(parent, mats):
    signals = ["e", "d", "COM", "c", "dp", "b", "a", "COM", "f", "g"]
    for pin, signal in enumerate(signals, start=1):
        col = pin-3 if pin<=5 else 8-pin
        z = PIN_ROW if pin<=5 else -PIN_ROW
        terminal = MeshBatch()
        terminal.cylindrical(col*PIN_PITCH, z, [(.019, -PIN_LENGTH), (PIN_RADIUS, -PIN_LENGTH+.013),
                                              (PIN_RADIUS, PIN_EGRESS+.017)], mats["tin"], 18, True)
        node = terminal.finish(f"Pin_{pin}", parent)
        node["Signal"] = signal


def studio(output):
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, -.434, 0), (24, .022, 24), material("Studio ground", "d6dfe1", roughness=.75), 0)
    stage.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.56, .65, .72, 1)
    background.inputs["Strength"].default_value = .50
    focus = (0, .166, 0)
    for name, point, energy, size in [("Key", (-2.3, 3.1, 2.2), 260, 3.0),
                                     ("Fill", (2.1, 2.4, 2.0), 150, 2.8),
                                     ("Edge", (1.2, 2.7, -2.6), 227, 2.5)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = energy, "DISK", size
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light, blender_point(focus))
    camera = bpy.data.cameras.new("Single digit display studio")
    camera.type, camera.ortho_scale = "ORTHO", 2.95
    view = bpy.data.objects.new("Single digit display studio", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((2.05, 4.2, 3.25))
    aim(view, blender_point(focus))
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 920
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
                ("case", "Light gray molded body", "aaaeb0", .01, .48),
                ("face", "Dark gray display face", "6d777b", .01, .50),
                ("epoxy", "Matte gray underside insert", "747c7d", .02, .62),
                ("collar", "Lead seating collar", "838f8e", .30, .40),
                ("tin", "Tinned 0.50 mm radial leads", "bcc6c8", .72, .34),
                ("lens", "White diffused optics, unlit", "deddd5", 0, .49)]}
    root = empty("SC56_COMMON")
    root["Reference"] = "Kingbright SC56-11EWA, common cathode, right hand decimal"
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up, digit top -Z, package seating plane y=0"
    root["Physical pins"] = "1=e; 2=d; 3=COM; 4=c; 5=dp; 6=b; 7=a; 8=COM; 9=f; 10=g"
    root["Visual scope"] = "Independent package reconstruction. Edge and material finishes are approximate."
    body, pins, optics = [empty(name) for name in ["SC56_BODY", "SC56_LEADS", "SC56_LENSES"]]
    for assembly in [body, pins, optics]:
        assembly.parent = root
    outlines = digit_outlines()
    case(body, mats, outlines)
    lenses(optics, mats, outlines)
    leads(pins, mats)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", export_yup=True, export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
