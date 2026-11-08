"""Build the Kingbright WP154A4SUREQBFZGW exterior in Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/rgbled_kingbright.py -- --output dist/models/rgbled-kingbright.glb

Lens and lead pitch follow Kingbright drawing DSAJ8688 V12A page 1.
The workbench uses clipped leads with the cathode longest, followed by blue.
The epoxy finish is interpreted. An individual lens mesh receives the three
channels' combined simulated emission. Add --render for the studio PNG.

https://www.kingbrightusa.com/images/catalog/SPEC/WP154A4SUREQBFZGW.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, empty, loops_faces, material


DATASHEET = "https://www.kingbrightusa.com/images/catalog/SPEC/WP154A4SUREQBFZGW.pdf"
BASE = .620
HEIGHT = .860
LENS_RADIUS, FLANGE_RADIUS, FLAT_X = .250, .295, -.270
PITCH, PICK_ABOVE_TIP = .127, .020
PINS = [("R", .31), ("COM", .06), ("B", .16), ("G", .31)]


def lens(parent, resin):
    # Flange, straight cylinder, and hemispherical nose in one emissive mesh.
    count = 96
    layers = [(0, .286, -.264), (.009, FLANGE_RADIUS, FLAT_X),
              (.091, FLANGE_RADIUS, FLAT_X), (.100, .286, -.264),
              (.100, .256, None), (.107, LENS_RADIUS, None)]
    equator = HEIGHT - LENS_RADIUS
    layers.extend((equator + LENS_RADIUS*math.sin(angle), LENS_RADIUS*math.cos(angle), None)
                  for step in range(25) for angle in [step*math.pi/50])
    batch = MeshBatch()
    rings = []
    for y, radius, flat in layers:
        ring = []
        for index in range(count):
            angle = index*math.tau/count
            x, z = radius*math.cos(angle), radius*math.sin(angle)
            ring.append((x if flat is None else max(flat, x), BASE+y, z))
        rings.append(ring)
    faces = [tuple(reversed(range(count))), *loops_faces(count, len(rings))]
    start = count*(len(rings)-1)
    tip = start+count
    faces.extend((start+i,start+(i+1)%count,tip) for i in range(count))
    batch.add([point for ring in rings for point in ring]+[(0,BASE+HEIGHT,0)], faces, resin, True)
    shape = batch.finish("RGBLED_DIFFUSED_LENS", parent)
    shape.data.polygons[0].use_smooth = False
    shape["Finish"] = "White diffused epoxy"
    shape["Locating flat"] = "Negative X, beside pin 1 (red)"


def leads(parent, tin):
    for index, (name, tip) in enumerate(PINS, start=1):
        x = (index-2.5)*PITCH
        # Square tinned leads with a narrow chamfer at each trimmed end.
        profile = [(tip,.018,.019), (tip+.013,.025,.025)]
        if tip<.20:
            if tip<.13:
                profile.extend([(.134,.025,.025),(.142,.034,.025)])
            else:
                profile.append((tip+.020,.034,.025))
            profile.extend([(.190,.034,.025),(.199,.025,.025)])
        profile.extend([(BASE-.012,.025,.025),(BASE+.010,.027,.027)])
        batch = MeshBatch()
        corners = [(-1,-1),(1,-1),(1,1),(-1,1)]
        vertices = [(x+side*width,y,front*depth) for y,width,depth in profile for side,front in corners]
        end = len(vertices)
        faces = [(3,2,1,0), *loops_faces(4,len(profile)), (end-4,end-3,end-2,end-1)]
        batch.add(vertices,faces,tin)
        lead = batch.finish("RGBLED_LEAD_"+name,parent)
        lead["Pin number"] = index
        lead["Endpoint"] = [x,tip+PICK_ABOVE_TIP,0]
        lead["Clipped tip Y"] = tip


def studio():
    scene = bpy.context.scene
    stage = MeshBatch()
    stage.box((0,.043,0),(40,.030,40),material("Studio backdrop","a7bcc7",0,.77),0)
    stage.finish("Studio backdrop")
    scene.world = bpy.data.worlds.new("Soft studio sky")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.65,.74,.83,1)
    sky.inputs["Strength"].default_value = .31
    focus = blender_point((0,.755,0))
    for name,point,power,size in [("Key",(-2.6,3.2,2.0),86,2.8),
                                  ("Fill",(2.5,2.2,2.8),46,2.1),
                                  ("Edge",(1.7,2.4,-2.6),73,2.1)]:
        light = bpy.data.lights.new(name,"AREA")
        light.energy,light.shape,light.size = power,"DISK",size
        obj = bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj,focus)
    camera = bpy.data.cameras.new("RGB lamp close-up")
    camera.type,camera.ortho_scale = "ORTHO",1.84
    view = bpy.data.objects.new("RGB lamp close-up",camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((-1.36,1.64,3.48))
    aim(view,focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x,scene.render.resolution_y = 660,880
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    return scene


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--blend",type=Path)
    parser.add_argument("--render",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    resin = material("Neutral white diffused resin","e5e6e2",.02,.35)
    tin = material("Tinned square lead frame","c2c7c3",.83,.31)
    root = empty("RGBLED_COMMON")
    root["Manufacturer part"] = "Kingbright WP154A4SUREQBFZGW"
    root["Manufacturer drawing"] = DATASHEET
    root["Axes"] = "Numeric centimetres, +Y lens up, inline pins at Z=0."
    root["Physical order"] = ["R","COM","B","G"]
    root["Common connection"] = "Cathode"
    root["Lead finish"] = "Clipped for benchtop viewing, with datasheet relative lengths retained."
    lens(root,resin)
    leads(root,tin)

    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    if args.render or args.blend:
        scene = studio()
    if args.blend:
        args.blend.parent.mkdir(parents=True,exist_ok=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()),compress=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath = str(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
