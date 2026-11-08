"""Build the SparkFun COM-09032 and BOB-09110 assembly in Blender 4.5 LTS.

blender -b -t 6 -P tools/blender/joystick_sparkfun.py -- --output dist/models/joystick-sparkfun.glb

Board outline, bores and routing landmarks were read from SparkFun's
Joystick-Breakout-v12 Eagle board file. The physical breakout design is by
SparkFun Electronics and licensed CC BY-SA 4.0. The reconstructed breakout
portion of this model is distributed under that license. The ALPS drawing
defines the frame and stem. Knob profile, finish, visible routing detail and
select travel are visual approximations. No third-party geometry is embedded.

https://github.com/sparkfun/Thumb_Joystick_Breakout
https://community.sparkfun.com/uploads/short-url/cOGToMVEWek42LIQcFH3zxYFB06.pdf
https://creativecommons.org/licenses/by-sa/4.0/
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rotate


CAD = "https://github.com/sparkfun/Thumb_Joystick_Breakout"
DRAWING = "https://community.sparkfun.com/uploads/short-url/cOGToMVEWek42LIQcFH3zxYFB06.pdf"
BOARD_BOTTOM, BOARD_TOP = .190, .350
WIDTH, DEPTH = 2.540, 3.175
JOYSTICK_Z, PIVOT_Y = -.1905, .945
PICK_Y, HEADER_Z, PRESS_TRAVEL = .355, 1.4605, .025
CONTACTS = [(name, (index-2)*.254) for index, name in enumerate(("VCC", "VERT", "HORIZ", "SEL", "GND"))]
MOUNTS = [(x,z) for x in (-1.016,1.016) for z in (-1.3335,1.3335)]
POT_H = [(x,1.016) for x in (-.254,0,.254)]
POT_V = [(-1.016,z) for z in (-.254,0,.254)]
SWITCH = [(x,z) for x in (-.3175,.3175) for z in (-1.270,-.762)]
FRAME = [(x,z) for x in (-.762,.762) for z in (-.66675,.66675)]


def plating(batch, x, z, drill, outer, mat):
    inner = drill-.001
    batch.cylindrical(x,z,[(inner, BOARD_BOTTOM-.005), (outer, BOARD_BOTTOM-.005),
                            (outer, BOARD_BOTTOM), (inner, BOARD_BOTTOM), (inner, BOARD_TOP),
                            (outer, BOARD_TOP), (outer, PICK_Y), (inner, PICK_Y),
                            (inner, BOARD_BOTTOM-.005)],mat,28)


def breakout(parent, mats):
    board = MeshBatch()
    board.loft([(BOARD_BOTTOM,WIDTH,DEPTH,.001),(BOARD_TOP,WIDTH,DEPTH,.001)],
               mats["mask"],sides=[mats["laminate"]])
    pcb = board.finish("JOYSTICK_RED_BOB_09110_PCB",parent)
    native = [(x,JOYSTICK_Z+z,.0445,.089) for x,z in POT_H+POT_V+SWITCH]
    native += [(x,JOYSTICK_Z+z,.06985,.1143) for x,z in FRAME]
    pads = [(x,HEADER_Z,.0508,.09398) for _,x in CONTACTS]
    drill = MeshBatch()
    for x,z,radius,_ in native+pads+[(x,z,.1651,.1651) for x,z in MOUNTS]:
        drill.cylindrical(x,z,[(radius,BOARD_BOTTOM-.05),(radius,BOARD_TOP+.05)],mats["tin"],32,True)
    cut_mesh(pcb,drill.finish("Breakout hole cutters"))
    for name,x in CONTACTS:
        pad = MeshBatch()
        plating(pad,x,HEADER_Z,.0508,.09398,mats["tin"])
        rim = pad.finish(f"JOYSTICK_CONTACT_{name}",parent,closed=False)
        rim["Endpoint"] = [x,PICK_Y,HEADER_Z]
    native_pads = MeshBatch()
    for x,z,inner,outer in native:
        plating(native_pads,x,z,inner,outer,mats["tin"])
    native_pads.finish("JOYSTICK_SOLDER_PADS",parent,closed=False)

    silk = MeshBatch()
    for x,z in MOUNTS:
        silk.cylindrical(x,z,[(.205,BOARD_TOP+.001),(.214,BOARD_TOP+.001)],mats["ink"],36)
    for x,z,dx,dz in [(-1.016,-1.020,0,-.254),(.978,-1.007,-.254,0)]:
        silk.ribbon([(x,z),(x+dx,z+dz)],BOARD_TOP+.001,.025,mats["ink"])
        for side in [-1,1]:
            tip = (x+dx,z+dz)
            wing = (tip[0]-.43*dx+side*.46*dz,tip[1]-.43*dz-side*.46*dx)
            silk.ribbon([tip,wing],BOARD_TOP+.001,.025,mats["ink"])
    silk.finish("JOYSTICK_BREAKOUT_SILK_ARROWS",parent,closed=False)


def bracket(parent, mats):
    z = JOYSTICK_Z
    base = MeshBatch()
    base.box((0,.440,z),(1.315,.170,1.382),mats["base"],.033)
    base.box((0,.538,z),(1.280,.078,1.290),mats["plastic"],.027)
    base.box((0,.672,z),(1.151,.250,1.164),mats["base"],.039)
    base.finish("JOYSTICK_PBT_LOWER_HOUSING",parent)

    plate = MeshBatch()
    plate.box((0,1.445,z),(1.315,.050,1.315),mats["steel"],.036)
    aperture = MeshBatch()
    aperture.cylindrical(0,z,[(.491,1.390),(.515,1.490)],mats["steel"],64,True)
    cut_mesh(plate.finish("JOYSTICK_STAMPED_FRAME_APERTURE",parent),aperture.finish("Gimbal aperture cutter"))

    frame = MeshBatch()
    for x,dz in FRAME:
        side = math.copysign(1,x)
        frame.box((x,.425,z+dz),(.053,.700,.100),mats["steel"],.005)
        frame.box((x-side*.066,.836,z+dz),(.180,.355,.147),mats["steel"],.011)
        frame.box((x-side*.138,1.169,z+dz*.916),(.122,.528,.128),mats["steel"],.009)
    for x in (-.623,.623):
        frame.box((x,1.298,z),(.051,.246,1.135),mats["steel"],.015)
        frame.box((x,.668,z),(.058,.151,.833),mats["steel"],.010)
    for dz in (-.626,.626):
        frame.box((0,1.366,z+dz),(1.119,.119,.049),mats["steel"],.012)
    frame.finish("JOYSTICK_FOLDED_TINPLATE_SIDES_AND_FEET",parent)

    for name, angle in [("HORIZONTAL",0),("VERTICAL",-math.pi/2)]:
        axis = MeshBatch()
        x,dz = rotate(0,.747,angle)
        axis.box((x,.823,z+dz),(.945,.946,.246),mats["teal"],.063,angle)
        axis.finish(f"JOYSTICK_{name}_POT_CARRIER",parent)
        dial = MeshBatch()
        cx,cy,cz = .0,.945,.876
        def section(radius, depth, count=40):
            result = []
            for i in range(count):
                a=i*math.tau/count
                xx,zz=rotate(cx+radius*math.cos(a),cz+depth,angle)
                result.append((xx,cy+radius*math.sin(a),z+zz))
            return result
        profile=[(.189,-.004),(.278,-.004),(.286,.022),(.202,.022),(.189,-.004)]
        dial.add([p for r,d in profile for p in section(r,d)],loops_faces(40,len(profile)),mats["teal"],True)
        for radius,depth,surface in [(.187,-.0005,mats["phenolic"]),(.096,.005,mats["ivory"])]:
            dial.add(section(radius,depth),[tuple(range(40))],surface)
        dial.finish(f"JOYSTICK_{name}_POT_ROTOR_DETAIL",parent,closed=False)

    switch = MeshBatch()
    switch.box((0,.613,z-.941),(.873,.510,.588),mats["ivory"],.035)
    switch.box((0,.748,z-1.247),(.721,.217,.031),mats["steel"],.009)
    switch.box((0,.877,z-.845),(.233,.090,.205),mats["plastic"],.014)
    switch.finish("JOYSTICK_SELECT_TACT_SWITCH",parent)

    legs = MeshBatch()
    for x,dz in POT_H+POT_V+SWITCH:
        legs.box((x,.282,z+dz),(.072,.407,.031),mats["tin"],.006)
        legs.cylindrical(x,z+dz,[(.026,.190),(.071,.177),(.072,.191)],mats["tin"],16,True)
    legs.finish("JOYSTICK_SOLDERED_NATIVE_LEGS",parent)


def moving_stick(parent,mats):
    stem = MeshBatch()
    stem.cylindrical(0,0,[(.227,-.148),(.307,-.054),(.311,.080),(.257,.186),
                            (.204,.260),(.199,1.218),(.178,1.300)],mats["plastic"],52,True)
    stem.finish("JOYSTICK_PBT_SHAFT",parent)

    # The lower skirt is a thin hollow moulding. It leaves room for the
    # stationary bracket and travels with the thumb cap through tilt/press.
    cap = MeshBatch()
    skirt = [(.560,2.095),(.738,2.083),(.860,1.992),(1.071,1.819),(1.222,1.587),
             (1.307,1.434),(1.321,1.374),(1.312,1.337),(1.267,1.321),(1.229,1.360),
             (1.220,1.441),(1.119,1.609),(.941,1.827),(.707,2.039),(.560,2.045),(.560,2.095)]
    cap.cylindrical(0,0,[(radius,y-PIVOT_Y) for radius,y in skirt],mats["rubber"],72)
    cap.cylindrical(0,0,[(radius,y-PIVOT_Y) for radius,y in
                         [(.560,2.045),(.627,2.065),(.656,2.135),(.685,2.210),
                          (.899,2.292),(.972,2.353),(.986,2.424),(.944,2.481),
                          (.824,2.495),(.654,2.484),(.447,2.472),(.220,2.467),(0,2.466)]],
                    mats["rubber"],96)
    cap.finish("JOYSTICK_CAP",parent,closed=False)


def studio():
    scene = bpy.context.scene
    plane = MeshBatch()
    plane.box((0,.004,0),(20,.024,20),material("Studio backdrop","dce6e7",0,.85),0)
    plane.finish("Studio backdrop")
    scene.world = bpy.data.worlds.new("Soft sky")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    sky.inputs["Color"].default_value = (.68,.76,.82,1)
    sky.inputs["Strength"].default_value = .40
    focus = blender_point((0,1.07,.02))
    for name,position,power,size in [("Key",(-3.6,5,3.8),465,4.2),
                                     ("Fill",(3.9,4,3),235,3.8),
                                     ("Edge",(0,4.3,-3.7),325,3.1)]:
        lamp = bpy.data.lights.new(name,"AREA")
        lamp.energy,lamp.shape,lamp.size = power,"DISK",size
        light = bpy.data.objects.new(name,lamp)
        bpy.context.collection.objects.link(light)
        light.location = blender_point(position)
        aim(light,focus)
    camera = bpy.data.cameras.new("Joystick studio")
    camera.type,camera.ortho_scale = "ORTHO",4.45
    view = bpy.data.objects.new("Joystick studio",camera)
    bpy.context.collection.objects.link(view)
    view.location = blender_point((3.31,4.75,5.40))
    aim(view,focus)
    scene.camera = view
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x,scene.render.resolution_y = 860,860
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
    mats = {key: material(name,color,metallic,roughness)
            for key,name,color,metallic,roughness in [
                ("mask","Breakout red solder mask","b6231d",.02,.40),
                ("laminate","FR4 routed board edge","97694d",.02,.58),
                ("ink","Off-white silkscreen","e9e8da",0,.54),
                ("tin","Tin-plated contacts","c9cecc",.76,.33),
                ("steel","Pressed plated frame","b6bcb9",.83,.34),
                ("base","Black lower PBT case","2d302c",.01,.50),
                ("plastic","PBT shaft and holder","373c37",.01,.48),
                ("rubber","Moulded charcoal cap","292c2c",0,.68),
                ("teal","Potentiometer teal carrier","25766d",0,.45),
                ("phenolic","Resistive wafer","745338",.03,.57),
                ("ivory","Natural switch moulding","d2d2bb",0,.52),
            ]}
    root = empty("JOYSTICK_COMMON")
    root["Assembly"] = "SparkFun COM-09032 on BOB-09110"
    root["Breakout design"] = CAD
    root["Breakout model license"] = "CC BY-SA 4.0; PCB design by SparkFun Electronics"
    root["ALPS dimensions"] = DRAWING
    root["Axes"] = "Centimetres. +Y up, −Z is the direction of V, +Z is the five-pin edge."
    body = empty("JOYSTICK_BODY")
    body.parent = root
    stick = empty("JOYSTICK_STICK")
    stick.parent = root
    stick.location = blender_point((0,PIVOT_Y,JOYSTICK_Z))
    stick["Max radial tilt degrees"] = 23
    plunger = empty("JOYSTICK_PLUNGER")
    plunger.parent = stick
    plunger["Illustrative select displacement Y"] = -PRESS_TRAVEL
    breakout(body,mats)
    bracket(body,mats)
    moving_stick(plunger,mats)

    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    if args.blend or args.render:
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
