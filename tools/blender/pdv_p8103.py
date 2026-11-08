"""Author an Advanced Photonix PDV-P8103 radial photocell in Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/pdv_p8103.py -- --output dist/models/pdv-p8103.glb

Package dimensions and the minimum untrimmed leads follow Rev. B, page 2.
The serpentine, ceramic, epoxy, and welded contacts are modeled from the
manufacturer's product image. Add --render for a full-lead studio PNG.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, empty, loops_faces, material


DATASHEET = "https://www.advancedphotonix.com/media/pages/our-products/light-dependent-resistor-ldr/pdv-p8103/e28dce9e68-1718287431/ds-pdv-p8103.pdf"
PRODUCT = "https://www.advancedphotonix.com/our-products/light-dependent-resistor-ldr/pdv-p8103"
RADIUS, HALF_DEPTH, FACE_Y = .255, .215, .200
HALF_PITCH, LEAD_RADIUS, LEAD_TIP_Y = .170, .025, -3.00
CONTACTS = ((1, -HALF_PITCH), (2, HALF_PITCH))


def clipped_head(batch, levels, surface):
    """Loft a circle bounded by two flats, following the top-view drawing."""
    limit = math.asin(HALF_DEPTH / RADIUS)
    arc = [-limit + 2*limit*i/26 for i in range(27)]
    outline = [(RADIUS * math.cos(a + offset), RADIUS * math.sin(a + offset))
               for offset in (0, math.pi) for a in arc]
    vertices = [(x * scale, y, z * scale) for y, scale in levels for x, z in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(levels)),
             tuple(range(len(vertices) - count, len(vertices)))]
    batch.add(vertices, faces, surface)


def housing(parent, ceramic, edge, substrate):
    base = MeshBatch()
    clipped_head(base, [(0., .953), (.008, .985), (.024, 1.), (.155, 1.),
                        (.176, .991), (.181, .966)], ceramic)
    base.finish("PDV_P8103_CERAMIC", parent)

    face = MeshBatch()
    clipped_head(face, [(.171, .995), (.179, .991), (.183, .964)], edge)
    clipped_head(face, [(.182, .954), (.185, .950)], substrate)
    face.finish("PDV_P8103_FACE_PLATE", parent)


def photosensitive_track(parent, surface):
    # The center turns narrow to leave both metal contact heads unobstructed.
    levels = (-.173, -.117, -.061, -.005, .051, .107, .163)
    turns = ((1, .104), (-1, -.111), (1, .079), (-1, -.079), (1, .112), (-1, -.102))
    path = [(-.115, levels[0])]
    for index, (side, x) in enumerate(turns):
        middle = (levels[index] + levels[index+1]) / 2
        radius = (levels[index+1] - levels[index]) / 2
        for step in range(15):
            angle = -math.pi/2 + step*math.pi/14
            path.append((x + side*radius*math.cos(angle), middle + radius*math.sin(angle)))
    path.append((.120, levels[-1]))

    vertices = []
    half_width = .014
    for index, (x, z) in enumerate(path):
        prev = path[max(0, index-1)]
        following = path[min(len(path)-1, index+1)]
        dx, dz = following[0] - prev[0], following[1] - prev[1]
        norm = math.hypot(dx, dz)
        nx, nz = -dz/norm*half_width, dx/norm*half_width
        vertices.extend(((x+nx, .184, z+nz), (x-nx, .184, z-nz),
                         (x-nx, .188, z-nz), (x+nx, .188, z+nz)))
    faces = [(3, 2, 1, 0), *loops_faces(4, len(path)),
             tuple(range(len(vertices)-4, len(vertices)))]
    track = MeshBatch()
    track.add(vertices, faces, surface)
    track.finish("PDV_P8103_CDS_TRACK", parent)


def welded_contacts(parent, steel, solder):
    for number, x in CONTACTS:
        rim = MeshBatch()
        rim.cylindrical(x, 0, [(.033, .181), (.036, .186), (.031, .192), (.023, .195)],
                        steel, 24, True)
        rim.cylindrical(x, 0, [(.024, .192), (.022, .196), (.018, .199)], solder, 24, True)
        rim.finish(f"PDV_P8103_WELD_{number}", parent)


def protective_glaze(parent, surface):
    glaze = MeshBatch()
    clipped_head(glaze, [(.187, .975), (.191, .976), (.197, .945), (FACE_Y, .910)], surface)
    glaze.finish("PDV_P8103_EPOXY_FACE", parent)


def leads(parent, steel, seal):
    group = empty("PDV_P8103_NATIVE_LEADS")
    group.parent = parent
    for number, x in CONTACTS:
        batch = MeshBatch()
        batch.cylindrical(x, 0, [(.016, LEAD_TIP_Y), (LEAD_RADIUS, LEAD_TIP_Y+.013),
                                 (LEAD_RADIUS, .005)], steel, 20, True)
        lead = batch.finish(f"PDV_P8103_LEAD_{number}", group)
        lead["Endpoint"] = [x, 0., 0.]
        lead["Untrimmed tip Y"] = LEAD_TIP_Y

        bead = MeshBatch()
        bead.cylindrical(x, 0, [(.026, -.205), (.027, -.126), (.030, -.049),
                                (.035, -.018), (.043, .001)], seal, 20, True)
        bead.finish(f"PDV_P8103_LEAD_EPOXY_{number}", group)


def studio():
    scene = bpy.context.scene
    ground = MeshBatch()
    ground.box((0, LEAD_TIP_Y-.030, 0), (35, .05, 35), material("Backdrop", "bcc7cb", 0, .78), 0)
    ground.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft studio sky")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.72, .76, .84, 1)
    sky.inputs["Strength"].default_value = .35
    focus = blender_point((0, -1.37, 0))
    for name, point, power, size in [("Key", (-2.3, 3., 2.5), 125, 2.85),
                                     ("Fill", (1.8, 2.0, 1.9), 70, 2.25),
                                     ("Rim", (1.2, .7, -2.5), 94, 2.2)]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.shape, light.size = power, "DISK", size
        lamp = bpy.data.objects.new(name, light)
        bpy.context.collection.objects.link(lamp)
        lamp.location = blender_point(point)
        aim(lamp, focus)
    camera = bpy.data.cameras.new("Photocell close-up")
    camera.type, camera.ortho_scale = "ORTHO", 2.28
    view = bpy.data.objects.new("Photocell close-up", camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((-1.03, 3.2, 2.67))
    aim(view, focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 930, 1080
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ceramic = material("Warm cream ceramic", "e9d6c7", 0, .36)
    edge = material("Sealed terracotta rim", "783332", 0, .32)
    substrate = material("Photocell face", "b89476", 0, .43)
    film = material("CdS pattern", "7b211e", 0, .40)
    steel = material("Steel lead frame", "c3bdb0", .74, .26)
    solder = material("Contact weld", "c5aca0", .64, .37)
    seal = material("Lead shoulder epoxy", "ccafa0", .02, .46)
    epoxy = material("Optical epoxy glaze", "fff1e6", 0, .18)
    epoxy.surface_render_method = "BLENDED"
    epoxy.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = .10

    root = empty("PDV_P8103_COMMON")
    root["Manufacturer part"] = "Advanced Photonix PDV-P8103"
    root["Manufacturer drawing"] = DATASHEET
    root["Manufacturer product photo"] = PRODUCT
    root["Axes"] = "Numeric centimetres, light faces +Y, ceramic bottom Y=0."
    root["Head width x depth x height in mm"] = [5.10, 4.30, 2.00]
    root["Minimum straight leads in mm"] = 30.00
    body = empty("PDV_P8103_BODY")
    body.parent = root
    housing(body, ceramic, edge, substrate)
    photosensitive_track(body, film)
    welded_contacts(body, steel, solder)
    protective_glaze(body, epoxy)
    leads(root, steel, seal)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()), export_format="GLB",
                              export_yup=True, export_extras=True)
    if args.render:
        scene = studio()
        args.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
