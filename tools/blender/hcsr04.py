"""Reconstruct the blue HC-SR04 from the ElecFreaks reference in Blender.

  blender -b -t 4 -P tools/blender/hcsr04.py -- --output dist/models/hcsr04.glb

Add --render research/qa/hcsr04-blender.png for a studio view. The GLB uses
numeric centimetres, +Y up and the header along the +Z edge. Only the outside
package and connector geometry are instructional. Small component placement
and mesh construction are representative of the photographed module.

https://www.elecfreaks.com/download/HC-SR04.pdf
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material


DATASHEET = "https://www.elecfreaks.com/download/HC-SR04.pdf"
WIDTH, DEPTH = 4.50, 2.00
BASE, TOP, RIM = .55, .71, 2.05
PIN_Z, PIN_TOP = .81, .76
MOUNT_HOLES = [(x, z) for x in [-2.075, 2.075] for z in [-.83, .83]]
PINS = [(name, (index - 1.5) * .254) for index, name in enumerate(["VCC", "TRIG", "ECHO", "GND"])]


def pcb(parent, mats):
    board = MeshBatch()
    board.loft([(BASE, WIDTH-.018, DEPTH-.018, .035),
                (BASE+.010, WIDTH, DEPTH, .044),
                (TOP-.009, WIDTH, DEPTH, .044),
                (TOP, WIDTH-.017, DEPTH-.017, .036)],
               mats["mask"], sides=[mats["mask"], mats["laminate"], mats["mask"]])
    shell = board.finish("HCSR04_PCB", parent)
    cuts = MeshBatch()
    drills = [(x,z,.095) for x,z in MOUNT_HOLES] + [(x,PIN_Z,.047) for _,x in PINS]
    for x, z, radius in drills:
        cuts.cylindrical(x, z, [(radius, BASE-.03), (radius, TOP+.03)], mats["tin"], 24, True)
    cut_mesh(shell, cuts.finish("Drilled mounting and header holes"))
    plating = MeshBatch()
    for x, z in MOUNT_HOLES:
        for y in [BASE-.001, TOP+.002]:
            plating.cylindrical(x, z, [(.095,y),(.135,y)], mats["tin"], 32)
    for _, x in PINS:
        for y in [BASE-.002, TOP+.003]:
            plating.cylindrical(x, PIN_Z, [(.047,y),(.088,y)], mats["tin"], 24)
    plating.finish("HCSR04_PCB_HOLE_PLATING", parent, closed=False)

    copper = MeshBatch()
    for index, (_, x) in enumerate(PINS):
        lead_z = .57 - index*.11
        copper.ribbon([(x, .72), (x, lead_z), (x*.68, lead_z-.067), (x*.68, -.12)],
                      TOP+.002, .018, mats["route"])
    for x in [-1.37, 1.37]:
        for side in [-1,1]:
            copper.ribbon([(x*.46, .11*side), (.49*x, .32*side), (.71*x, .32*side), (x, .19*side)],
                          TOP+.002, .030, mats["route"])
    copper.finish("HCSR04_ILLUSTRATIVE_ROUTING", parent, closed=False)


def mesh_wire(batch, x, y, z, half_span, along_x, mat):
    segments = 6
    vertices = []
    for end in [-half_span, half_span]:
        for index in range(segments):
            angle = index * math.tau / segments
            height, side = .010 * math.cos(angle), .010 * math.sin(angle)
            vertices.append((x+end, y+height, z+side) if along_x else (x+side, y+height, z+end))
    faces = [tuple(reversed(range(segments))), *loops_faces(segments,2), tuple(range(segments,segments*2))]
    batch.add(vertices, faces, mat, smooth=True)


def transducer(parent, x, name, mats):
    z = -.035
    assembly = empty("HCSR04_"+name)
    assembly.parent = parent
    seat = MeshBatch()
    seat.cylindrical(x,z,[(.787,TOP+.007),(.838,TOP+.015),(.838,TOP+.043),(.805,TOP+.068)],
                     mats["tin"], 64, True)
    seat.finish("HCSR04_"+name+"_SEAT", assembly)
    can = MeshBatch()
    can.cylindrical(x,z,[(.797,TOP+.035),(.817,TOP+.072),(.817,RIM-.049),
                         (.810,RIM-.019),(.794,RIM),(.697,RIM),(.684,RIM-.014),
                         (.684,RIM-.185),(.764,RIM-.185),(.773,TOP+.038),(.797,TOP+.035)],
                    mats["aluminum"], 72)
    can.finish("HCSR04_"+name+"_OPEN_CAN", assembly)
    membrane = MeshBatch()
    membrane.cylindrical(x,z,[(.684,RIM-.174),(.684,RIM-.165),(.538,RIM-.157)],
                         mats["membrane"], 60, True)
    membrane.finish("HCSR04_"+name+"_RECESSED_MEMBRANE", assembly)
    guard = MeshBatch()
    radius = .681
    for along_x in [True,False]:
        for index in range(-13,14):
            offset = index*.049
            length = math.sqrt(radius**2-offset**2)
            mesh_wire(guard, x if along_x else x+offset, RIM-(.070 if along_x else .085),
                      z+offset if along_x else z, length, along_x, mats["screen"])
    guard.finish("HCSR04_"+name+"_PERFORATED_SCREEN", assembly)


def header(parent, mats):
    group = empty("HCSR04_HEADER")
    group.parent = parent
    plastic = MeshBatch()
    for _, x in PINS:
        plastic.box((x,BASE-.114,PIN_Z),(.251,.220,.248),mats["plastic"],.020)
    plastic.finish("HCSR04_HEADER_SPACER", group)
    for name, x in PINS:
        pin = MeshBatch()
        pin.loft([(.016,.043,.043,.005),(.046,.064,.064,.005),
                  (PIN_TOP-.029,.064,.064,.005),(PIN_TOP,.051,.051,.005)],
                 mats["tin"], (x,PIN_Z))
        pin.cylindrical(x,PIN_Z,[(.065,TOP+.003),(.064,TOP+.016),(.043,TOP+.036)],
                        mats["tin"],24)
        terminal = pin.finish("HCSR04_PIN_"+name,group)
        terminal["Electrical contact centre"] = [x,PIN_TOP,PIN_Z]


def components(parent,mats):
    group = empty("HCSR04_ELECTRONICS")
    group.parent = parent
    front = MeshBatch()
    front.box((0,TOP+.025,-.42),(1.02,.05,.36),mats["tin"],.10)
    front.box((0,TOP+.16,-.42),(.94,.268,.308),mats["aluminum"],.10)
    for x,z in [(-.37,-.08),(.34,-.12),(-.34,.42),(.34,.41)]:
        front.box((x,TOP+.035,z),(.107,.063,.077),mats["ceramic"],.01)
        for side in [-1,1]:
            front.box((x+side*.055,TOP+.028,z),(.025,.040,.081),mats["tin"],.006)
    front.finish("HCSR04_FRONT_CRYSTAL_AND_PASSIVES",group)
    back = MeshBatch()
    for x,z,w,d in [(-.49,-.08,.58,.38),(.52,.08,.67,.39)]:
        back.box((x,BASE-.067,z),(w,.129,d),mats["plastic"],.038)
        for offset in range(-3,4):
            for side in [-1,1]:
                back.box((x+offset*.071,BASE-.025,z+side*d/2),(.030,.037,.081),mats["tin"],.006)
    for x in [-1.56,-1.24,-.96,.97,1.25,1.58]:
        for z in [-.45,.41]:
            back.box((x,BASE-.041,z),(.126,.079,.086),mats["ceramic"],.01)
            for side in [-1,1]:
                back.box((x+side*.062,BASE-.025,z),(.024,.044,.088),mats["tin"],.004)
    back.finish("HCSR04_REAR_CONTROL_COMPONENTS",group)


def silk(parent, mats):
    group = empty("HCSR04_SILK")
    group.parent = parent
    labels = [("HC-SR04",0,.235,.175),("Y1",0,-.166,.087),
              ("T",-1.83,.875,.124),("R",1.83,.875,.124),
              *((name,x,.625,.090) for name,x in PINS)]
    for label,x,z,size in labels:
        font = bpy.data.curves.new("Silk "+label,"FONT")
        font.body,font.size,font.align_x,font.align_y = label,size,"CENTER","CENTER"
        obj = bpy.data.objects.new("HCSR04_SILK_"+label,font)
        bpy.context.collection.objects.link(obj)
        obj.parent = group
        obj.location = blender_point((x,TOP+.005,z))
        font.materials.append(mats["ink"])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)


def studio(output):
    scene = bpy.context.scene
    floor = MeshBatch()
    floor.box((0,-.025,0),(14,.037,14),material("Studio ground","bbc9cc",roughness=.65),0)
    floor.finish("Studio ground")
    scene.world = bpy.data.worlds.new("Soft ambient")
    scene.world.use_nodes = True
    light = scene.world.node_tree.nodes.get("Background")
    light.inputs["Color"].default_value = (.57,.66,.74,1)
    light.inputs["Strength"].default_value = .72
    target = (0,.97,0)
    for name,point,energy,size in [("Key",(-3.5,5.5,3.1),460,4.6),
                                  ("Fill",(3.1,3.5,2.2),270,3.5),
                                  ("Rim",(0,4.6,-3.6),520,3.1)]:
        data = bpy.data.lights.new(name,"AREA")
        data.energy,data.shape,data.size = energy,"DISK",size
        obj = bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj,blender_point(target))
    camera_data = bpy.data.cameras.new("HC-SR04 studio")
    camera_data.type,camera_data.ortho_scale = "ORTHO",5.35
    camera = bpy.data.objects.new("HC-SR04 studio",camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = blender_point((.95,6.35,6.2))
    aim(camera,blender_point(target))
    scene.camera = camera
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 22
    scene.cycles.use_denoising = True
    scene.render.resolution_x,scene.render.resolution_y = 1000,780
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--render",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {key:material(name,color,metal,roughness) for key,name,color,metal,roughness in [
        ("mask","Blue solder mask","08518c",.04,.48),
        ("laminate","Exposed board laminate","a58c54",.02,.66),
        ("route","Copper under blue solder mask","145e98",.05,.47),
        ("aluminum","Satin aluminum transducer cans","bdc6cb",.86,.31),
        ("tin","Solder and tin-plated header","c2c9c2",.73,.34),
        ("screen","Dark woven acoustic screen","343d40",.63,.48),
        ("membrane","Dark acoustic recess","181d1d",.13,.78),
        ("plastic","Black header and packages","262a2e",.02,.61),
        ("ceramic","Chip capacitor ceramic","a8885d",.04,.68),
        ("ink","White screen print","e3ebe7",0,.61)]}
    root = empty("HCSR04_COMMON")
    root["Reference"] = "ElecFreaks HC-SR04, nominal 45 × 20 × 15 mm excluding header tails"
    root["Manufacturer document"] = DATASHEET
    root["Units"] = "Numeric centimetres, +Y sensing face, header edge +Z"
    root["Pin order, viewed face up"] = "VCC, TRIG, ECHO, GND; pitch 2.54 mm"
    root["Visual scope"] = "Independent exterior reconstruction. Electronics and finishes are approximate."
    pcb(root,mats)
    transducer(root,-1.37,"TRANSMITTER",mats)
    transducer(root,1.37,"RECEIVER",mats)
    header(root,mats)
    components(root,mats)
    silk(root,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                             export_yup=True,export_extras=True)
    if args.render:
        args.render.parent.mkdir(parents=True,exist_ok=True)
        studio(args.render.resolve())
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
