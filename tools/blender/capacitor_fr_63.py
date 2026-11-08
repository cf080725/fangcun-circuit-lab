"""Build a radial 6.3 mm FR-style capacitor in Blender 4.5 LTS.

  blender -b -t 4 -P tools/blender/capacitor_fr_63.py -- --output dist/models/capacitor-fr-63.glb

Use --render to capture the complete package including native leads. The
6.3 × 11.2 mm sleeve, 2.5 mm lead pitch, and 0.5 mm wire diameter reference
Panasonic EEUFR1E101. The score, color, and sleeve typography are simplified.
No vendor mesh, textures, branding, voltage, or capacitance text is baked in.

The GLB uses numeric centimetres, +Y up, and the base bung at y=0. The
negative stripe is centered on +X. The runtime can omit CAP_NATIVE_LEADS
and supply its own formed leads while retaining the physical sleeve.

https://industrial.panasonic.com/ww/products/pt/aluminum-cap-lead/models/EEUFR1E101
https://industrial.panasonic.com/cdbs/www-data/pdf/RDF0000/ABA0000C1259.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, material


REFERENCE = "https://industrial.panasonic.com/ww/products/pt/aluminum-cap-lead/models/EEUFR1E101"
DATASHEET = "https://industrial.panasonic.com/cdbs/www-data/pdf/RDF0000/ABA0000C1259.pdf"
RADIUS, HEIGHT, LEAD_X, LEAD_RADIUS = .315, 1.120, .125, .025


def add_sector(mesh, sections, start, stop, count, mat):
    points = [(radius*math.cos(theta), y, radius*math.sin(theta))
              for radius,y in sections for index in range(count+1)
              for theta in [start+(stop-start)*index/count]]
    ring = count+1
    faces = [(layer*ring+i+1, layer*ring+i, (layer+1)*ring+i, (layer+1)*ring+i+1)
             for layer in range(len(sections)-1) for i in range(count)]
    mesh.add(points, faces, mat, smooth=True)


def sleeve(parent, mats):
    profile = [(.264, .019), (.288, .032), (.307, .053), (RADIUS, .113),
               (RADIUS, .216), (.298, .254), (.291, .301), (.299, .347),
               (RADIUS, .384), (RADIUS, 1.043), (.308, 1.085), (.295, 1.109),
               (.279, HEIGHT)]
    half_band = math.tau / 15
    wrap = MeshBatch()
    add_sector(wrap, profile, half_band, math.tau-half_band, 52, mats["wrap"])
    wrap.finish("CAP_PET_SLEEVE", parent, closed=False)
    stripe = MeshBatch()
    add_sector(stripe, profile, -half_band, half_band, 8, mats["stripe"])
    stripe.finish("CAP_NEGATIVE_STRIPE", parent, closed=False)
    signs = MeshBatch()
    for y in [.167, .449, .666, .883]:
        add_sector(signs, [(RADIUS+.0008, y-.016), (RADIUS+.0008, y+.016)],
                   -.195, .195, 6, mats["ink"])
    signs.finish("CAP_NEGATIVE_MINUS_MARKS", parent, closed=False)


def case(parent, mats):
    metal = MeshBatch()
    metal.cylindrical(0, 0, [(.251, .006), (.275, .015), (.291, .035), (.301, .058),
                             (.302, .125), (.303, .211), (.286, .254), (.280, .298),
                             (.286, .343), (.301, .388), (.302, 1.041), (.298, 1.075),
                             (.286, 1.100), (.275, 1.110), (.263, 1.107), (.252, 1.088)],
                      mats["aluminium"], 64)
    metal.finish("CAP_ALUMINIUM_CASE_AND_CRIMP", parent)

    disk = MeshBatch()
    disk.cylindrical(0, 0, [(.256, 1.043), (.258, 1.078), (.247, 1.095)], mats["disc"], 64, True)
    scored = disk.finish("CAP_SCORED_PRESSURE_RELIEF", parent)
    for angle in [math.pi/4, -math.pi/4]:
        cut = MeshBatch()
        cut.box((0, 1.103, 0), (.363, .048, .021), mats["disc"], 0, angle)
        cut_mesh(scored, cut.finish("Pressure relief score cutter", parent))

    seal = MeshBatch()
    seal.cylindrical(0, 0, [(.252, 0), (.261, .014), (.263, .037), (.249, .070)], mats["rubber"], 56, True)
    bung = seal.finish("CAP_RUBBER_BUNG", parent)
    collars, holes = MeshBatch(), MeshBatch()
    for x in [-LEAD_X, LEAD_X]:
        holes.cylindrical(x, 0, [(.027, -.010), (.027, .082)], mats["rubber"], 24, True)
        collars.cylindrical(x, 0, [(.038, .001), (.037, .014), (.028, .014), (.028, .001), (.038, .001)],
                            mats["seal"], 24)
    cut_mesh(bung, holes.finish("Bung lead bore cutter", parent))
    collars.finish("CAP_LEAD_EGRESS_COLLARS", parent)


def native_leads(parent, mats):
    for name, x, length in [("CAP_POSITIVE_NATIVE_LEAD", -LEAD_X, 1.45),
                             ("CAP_NEGATIVE_NATIVE_LEAD", LEAD_X, 1.12)]:
        pin = MeshBatch()
        pin.cylindrical(x, 0, [(.018, -length), (LEAD_RADIUS, -length+.011),
                               (LEAD_RADIUS, .040)], mats["tin"], 24, True)
        pin.finish(name, parent)


def studio(output):
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0, -1.484, 0), (25, .025, 25), material("Studio ground", "cfdbdf", roughness=.73), 0)
    stage.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft studio ambient")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.60, .69, .74, 1)
    background.inputs["Strength"].default_value = .52
    focus = (0, -.147, 0)
    for name, point, power, size in [("Key", (3.2, 3.8, -1.5), 280, 2.8),
                                    ("Fill", (1.4, 2.0, 3.0), 150, 2.6),
                                    ("Edge", (-2.1, 2.6, 1.0), 240, 2.0)]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.energy, lamp.shape, lamp.size = power, "DISK", size
        light = bpy.data.objects.new(name, lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(point)
        aim(light, blender_point(focus))
    camera = bpy.data.cameras.new("FR capacitor studio")
    camera.type, camera.ortho_scale = "ORTHO", 3.22
    view = bpy.data.objects.new("FR capacitor studio", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((3.2, 3.0, 3.75))
    aim(view, blender_point(focus))
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 800, 1000
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
                ("wrap", "Black PET heat shrink", "22272e", .01, .32),
                ("stripe", "Pale gray negative polarity band", "aeb8be", .03, .42),
                ("ink", "Dark repeated minus symbols", "22282d", 0, .59),
                ("aluminium", "Rolled aluminium can", "b2bec3", .78, .32),
                ("disc", "Stamped aluminium pressure relief", "c7cbcd", .76, .38),
                ("rubber", "Moulded black rubber bung", "333b3e", 0, .63),
                ("seal", "Lead seal edge", "526164", .02, .58),
                ("tin", "Tinned wire leads", "bec8c9", .73, .32)]}
    root = empty("CAP_COMMON")
    root["Reference"] = "Panasonic EEUFR1E101 6.3 x 11.2 mm nominal FR-A outline"
    root["Manufacturer model"] = REFERENCE
    root["Manufacturer drawing"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y up, base at y=0, negative stripe on +X"
    root["Visual scope"] = "Independent exterior reconstruction. The vent stamp and sleeve ink are illustrative."
    body, pins = empty("CAP_BODY"), empty("CAP_NATIVE_LEADS")
    body.parent = pins.parent = root
    pins["Native pitch"] = "2.5 mm nominal, 0.5 mm diameter"
    case(body, mats)
    sleeve(body, mats)
    native_leads(pins, mats)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB", export_yup=True, export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True, exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
