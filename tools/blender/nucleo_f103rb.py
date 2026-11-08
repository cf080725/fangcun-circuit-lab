"""Build a NUCLEO-F103RB MB1136 C-series model in Blender 4.5.

  blender -b -P tools/blender/nucleo_f103rb.py -- --output dist/models/nucleo-f103rb.glb

Optional --render and --top-render paths save a studio view and a calibrated
800×960 reference image. The top view covers x ±3.8 cm and z ±4.56 cm.

Physical references: ST UM1724 figures 3–5 and 13, MB1136 C05 schematic,
and a straight-on retail photo of the F103RB. Board dimensions and 2.54 mm
pitch are specified by ST. Remaining component placements are reconstructed
from those views; component shells, surface marks, and routing are illustrative.
No ST design file or logo is embedded in the model.

https://www.st.com/resource/en/user_manual/dm00105823.pdf
https://www.st.com/resource/en/schematic_pack/mb1136-default-c05_schematic.pdf
https://akizukidenshi.com/catalog/g/g107724/

Model coordinates are numeric centimetres, +Y up. The USB mouth faces -Z.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from arduino_nano import gullwing, usb_section
from blue_pill import MeshBatch, aim, blender_point, cut_mesh, empty, loops_faces, material, rotate
from uno_r3 import rectangular_port

MANUAL = "https://www.st.com/resource/en/user_manual/dm00105823.pdf"
SCHEMATIC = "https://www.st.com/resource/en/schematic_pack/mb1136-default-c05_schematic.pdf"
BOTTOM, TOP = .21, .35
PITCH, MORPHO_TIP, ARDUINO_TOP = .254, .96, 1.20
MORPHO = {"CN7": (-3.175, -.955), "CN10": (2.921, -.955)}
ARDUINO = {"CN5": (2.413, -.8534, 10), "CN9": (2.413, 1.839, 8),
           "CN6": (-2.413, .061, 8), "CN8": (-2.413, 2.347, 6)}
MOUNTS = [(-2.413, -1.321), (2.413, -1.219), (.887, 3.861)]
B1, B2, LD2, LD3 = (-.84, -1.26), (.84, -1.26), (.96, .13), (-1.36, .12)
TARGET, ST_LINK = (-.28, 1.65), (.04, -2.65)
SEAM_Z = -1.69

# Outline calibrated to 70.00 × 82.50 mm, including bevelled lower corners,
# the shallow side notches and the separated ST-LINK bridge.
OUTLINE = [
    (-3.50, -4.00), (-3.38, -4.125), (3.38, -4.125), (3.50, -4.00),
    (3.50, -1.80), (3.37, SEAM_Z), (3.50, -1.58), (3.50, 3.86),
    (3.39, 3.97), (1.45, 3.97), (1.24, 4.125), (-2.31, 4.125),
    (-2.52, 3.97), (-3.38, 3.97), (-3.50, 3.86), (-3.50, -1.58),
    (-3.37, SEAM_Z), (-3.50, -1.80),
]


def port_centres():
    morpho = [(name, 2*row+column+1, x+column*PITCH, z+row*PITCH)
              for name, (x,z) in MORPHO.items() for row in range(19) for column in range(2)]
    arduino = [(name, i+1, x, z+i*PITCH) for name, (x,z,count) in ARDUINO.items() for i in range(count)]
    return morpho, arduino


def make_pcb(root, mats, contacts):
    layers = [BOTTOM, BOTTOM+.007, TOP-.007, TOP]
    vertices = [(x,y,z) for y in layers for x,z in OUTLINE]
    n = len(OUTLINE)
    body = MeshBatch()
    body.add(vertices, [tuple(reversed(range(n))), *loops_faces(n, len(layers)),
                        tuple(range(3*n,4*n))], mats["mask"])
    body.materials.append(mats["fr4"])
    body.indices[1+n:1+2*n] = [1]*n
    pcb = body.finish("NUCLEO_PCB_WHITE_MASK_AND_LAMINATE", root)

    cutters = MeshBatch()
    for x,z in MOUNTS:
        cutters.cylindrical(x,z,[(.160,BOTTOM-.045),(.160,TOP+.045)],mats["mask"],28,True)
    for _,_,x,z in contacts:
        cutters.cylindrical(x,z,[(.049,BOTTOM-.035),(.049,TOP+.035)],mats["mask"],12,True)
    for x,width in [(-2.69,1.24),(-.71,1.96),(1.05,.82)]:
        cutters.box((x,(BOTTOM+TOP)/2,SEAM_Z),(width,.28,.106),mats["mask"],.052)
    cut_mesh(pcb, cutters.finish("Temporary holes and pre-cut slots"))

    rims = MeshBatch()
    for x,z in MOUNTS:
        for y in (BOTTOM-.002, TOP+.002):
            rims.cylindrical(x,z,[(.160,y),(.203,y)],mats["tin"],28)
    for _,_,x,z in contacts:
        rims.cylindrical(x,z,[(.048,BOTTOM-.007),(.088,BOTTOM-.007),(.085,BOTTOM+.003)],mats["tin"],12)
    rims.finish("NUCLEO_BORE_AND_REAR_SOLDER_RINGS",root,closed=False)


def make_headers(root, mats, morpho, arduino):
    mould, pins = MeshBatch(), MeshBatch()
    for _,_,x,z in morpho:
        square_loft(mould,x,z,[(.350,.250),(.533,.250),(.544,.231)],mats["plastic"])
        square_loft(pins,x,z,[(.025,.060),(.942,.063),(.960,.040)],mats["gold"])
    mould.finish("NUCLEO_MORPHO_2X19_MOULDINGS",root)
    posts = pins.finish("NUCLEO_MORPHO_76_POSTS",root)
    posts["tip_y_cm"] = MORPHO_TIP
    posts["positions_cm"] = [[x,z] for _,_,x,z in morpho]

    mould, contacts = MeshBatch(), MeshBatch()
    for _,_,x,z in arduino:
        vertices,faces = rectangular_port(x,z,TOP+.004,ARDUINO_TOP,.104,.251)
        mould.add(vertices,faces,mats["plastic"])
        contacts.box((x,.267,z),(.064,.478,.064),mats["tin"],0)
        for sign in (-1,1):
            contacts.box((x+sign*.043,.812,z),(.016,.317,.061),mats["tin"],0)
            contacts.box((x+sign*.037,.965,z),(.024,.042,.049),mats["gold"],0)
    mould.finish("NUCLEO_ARDUINO_32_OPEN_FEMALE_SOCKETS",root)
    mould = contacts.finish("NUCLEO_ARDUINO_SOCKET_SPRINGS_AND_TAILS",root)
    mould["opening_y_cm"] = ARDUINO_TOP
    mould["positions_cm"] = [[x,z] for _,_,x,z in arduino]


def square_loft(batch, x, z, sections, mat):
    vertices = [(x+sx*w/2,y,z+sz*w/2) for y,w in sections
                for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    top = len(vertices)-4
    batch.add(vertices,[(3,2,1,0), *loops_faces(4,len(sections)),tuple(range(top,top+4))],mat)


def make_usb(root, mats):
    x, front, rear = 1.19, -4.252, -3.363
    shell = MeshBatch()
    sections = [(front+.030,.702,.391,.699),(front,.728,.374,.728),
                (front+.042,.772,.350,.745),(rear,.769,.350,.743),
                (rear,.682,.397,.699),(front+.032,.650,.399,.682)]
    points = [(x+dx,y,z) for section in sections for dx,y,z in usb_section(*section)]
    last = len(points)-8
    rim = [(last+i,last+(i+1)%8,(i+1)%8,i) for i in range(8)]
    shell.add(points,[*loops_faces(8,len(sections)),*rim],mats["steel"])
    for side in (-1,1):
        shell.box((x+side*.410,.372,rear-.15),(.155,.044,.306),mats["tin"],.013)
        shell.box((x+side*.267,.741,front+.25),(.102,.008,.212),mats["shadow"],.019)
        shell.box((x+side*.292,.747,front+.27),(.030,.011,.151),mats["steel"],.008)
    shell.finish("NUCLEO_CN1_MINI_B_OPEN_SHELL",root)

    insert = MeshBatch()
    insert.box((x,.545,rear-.040),(.632,.306,.112),mats["plastic"],.015)
    insert.box((x,.483,front+.51),(.499,.106,.585),mats["usb"],.014)
    for i in range(-2,3):
        insert.box((x+i*.079,.541,front+.49),(.037,.011,.464),mats["gold"],.004)
    insert.finish("NUCLEO_CN1_TONGUE_AND_FIVE_CONTACTS",root)


def qfp(root, mats, name, center, width, count, pitch=.05):
    x,z = center
    package = MeshBatch()
    package.loft([(TOP+.018,width-.043,width-.043,.021),(TOP+.037,width,width,.027),
                  (TOP+.139,width,width,.026),(TOP+.159,width-.053,width-.053,.021)],
                 mats["mold"],center)
    reach = width/2
    profile = [(reach-.013,TOP+.084),(reach+.036,TOP+.084),(reach+.071,TOP+.024),
               (reach+.105,TOP+.024),(reach+.105,TOP+.004),(reach+.058,TOP+.004),
               (reach+.026,TOP+.063),(reach-.013,TOP+.063)]
    for side in range(4):
        angle = side*math.pi/2
        for pin in range(count):
            t = (pin-(count-1)/2)*pitch
            ox,oz = rotate(0,t,angle)
            gullwing(package,profile,.023,(x+ox,z+oz),angle,mats["tin"])
            sx,sz = rotate(reach+.086,t,angle)
            package.box((x+sx,TOP+.003,z+sz),(.098,.006,.034),mats["solder"],0,angle)
    package.cylindrical(x-width*.35,z-width*.35,[(.035,TOP+.159),(.035,TOP+.160)],mats["mark"],16,True)
    obj = package.finish(name,root)
    obj["lead_count"] = count*4
    return obj


def pushbutton(root, mats, name, center, cap_material):
    x,z = center
    base = MeshBatch()
    base.box((x,TOP+.112,z),(.610,.224,.610),mats["plastic"],.024)
    base.loft([(TOP+.193,.610,.610,.050),(TOP+.228,.599,.599,.047),
               (TOP+.249,.547,.547,.043)],mats["steel"],center)
    for side in (-1,1):
        for along in (-1,1):
            base.box((x+side*.304,TOP+.019,z+along*.209),(.145,.039,.118),mats["tin"],.010)
    base.finish(name+"_BASE_AND_LEADS",root)
    cap = MeshBatch()
    cap.cylindrical(x,z,[(.184,TOP+.239),(.209,TOP+.269),(.210,TOP+.358),
                         (.193,TOP+.386),(.168,TOP+.389)],cap_material,32,True)
    cap = cap.finish(name+"_CAP",root)
    cap["travel_cm"] = .025


def led(root, mats, name, center, lens):
    x,z = center
    base = MeshBatch()
    base.box((x,TOP+.015,z),(.218,.030,.126),mats["ledbase"],.012)
    for sign in (-1,1):
        base.box((x+sign*.099,TOP+.019,z),(.058,.038,.130),mats["tin"],.005)
    base.finish(name+"_BASE_AND_PADS",root)
    dome = MeshBatch()
    dome.loft([(TOP+.029,.175,.113,.022),(TOP+.043,.173,.111,.022),
               (TOP+.088,.153,.098,.019),(TOP+.098,.132,.084,.016)],lens,center)
    return dome.finish(name+"_LENS",root)


def passives(root, mats):
    parts = MeshBatch()
    parts.loft([(TOP+.010,.373,.979,.175),(TOP+.036,.388,.998,.180),
                (TOP+.277,.388,.998,.180),(TOP+.299,.345,.952,.160)],mats["steel"],(-.936,-2.58))
    for x,z,w,d,h in [(-1.13,-.23,.547,.695,.183),(2.57,-2.10,.475,.350,.111),
                       (1.81,-.22,.304,.264,.129),(2.48,-2.66,.257,.286,.105)]:
        parts.box((x,TOP+h/2,z),(w,h,d),mats["mold"],.023)
        for offset in (-.26,0,.26):
            parts.box((x+w*offset,TOP+.012,z+d*.59),(.052,.024,.104),mats["tin"],0)
        parts.box((x,TOP+.018,z-d*.58),(w*.63,.036,.137),mats["steel"],0)
    for x,z,w,d in [(-1.71,-.032,.277,.341),(-.17,-.16,.257,.326),(-1.64,-.64,.279,.180)]:
        parts.box((x,TOP+.075,z),(w,.15,d),mats["ceramic"],.025)
        for side in (-1,1):
            parts.box((x+side*w*.40,TOP+.057,z),(w*.24,.115,d),mats["tin"],0)
    pads = [(-1.33,3.34),(-1.08,3.34),(-.52,3.36),(-.02,3.36)]
    for x,z in pads:
        parts.box((x,TOP+.004,z),(.119,.008,.107),mats["tin"],0)
    connectors = [(-2.70,-3.38,6,0,PITCH,False),(-1.25,-3.72,2,0,PITCH,True),
                  (.66,-.73,3,PITCH,0,True),(-.43,.40,2,PITCH,0,True),
                  (-2.30,-2.31,2,0,PITCH,False),(-3.19,-3.92,2,0,PITCH,False),
                  (3.19,-3.92,2,0,PITCH,False)]
    for x,z,count,dx,dz,jumpered in connectors:
        for i in range(count):
            px,pz = x+i*dx,z+i*dz
            square_loft(parts,px,pz,[(.350,.247),(.532,.247),(.544,.231)],mats["plastic"])
            square_loft(parts,px,pz,[(.416,.061),(.970,.061),(.984,.039)],mats["gold"])
        if jumpered:
            width,depth = (.488,.292) if dx else (.292,.488)
            parts.box((x+dx/2,.736,z+dz/2),(width,.376,depth),mats["plastic"],.027)

    groups = [(-2.01,-3.34,2,6),(-1.55,-2.92,1,8),(.32,-3.60,3,4),
              (1.72,-3.30,3,4),(1.12,-2.74,4,2),(1.46,-2.05,3,2),
              (-.04,-1.34,1,7),(-.71,.30,2,4),(.67,.23,2,3),
              (.58,1.14,3,3),(-1.42,1.56,2,3),(.68,2.34,2,3),
              (-.78,2.62,4,2),(.49,2.74,3,2)]
    for x,z,cols,rows in groups:
        for col in range(cols):
            for row in range(rows):
                px,pz = x+col*.131,z+row*.118
                body = mats["mold"] if (col+row)%3 == 0 else mats["ceramic"]
                parts.box((px,TOP+.023,pz),(.096,.046,.060),body,0)
                for side in (-1,1):
                    parts.box((px+side*.039,TOP+.024,pz),(.026,.048,.063),mats["tin"],0)
    parts.finish("NUCLEO_FIXED_PASSIVES_REGULATORS_AND_DEBUG_HEADERS",root)


def text_mesh(root, mats, label, x, z, size, y=TOP+.002, surface="silk", rotation=0):
    curve = bpy.data.curves.new(label, "FONT")
    curve.body, curve.size, curve.align_x = label, size, "CENTER"
    curve.space_character = 1.0
    curve.materials.append(mats[surface])
    obj = bpy.data.objects.new(label, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((x,y,z))
    obj.rotation_euler.z = rotation
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.select_set(False)
    obj.parent = root


def markings(root, mats):
    silks = empty("NUCLEO_ILLUSTRATIVE_SILK")
    silks.parent = root
    for label,x,z,size in [
        ("NUCLEO", -2.24, -3.73, .26), ("F103RB", -2.21, -3.43, .22), ("ST-LINK", .12, -3.92, .18),
        ("CN1", 1.82, -3.74, .13), ("SWD", -2.64, -3.05, .14), ("CN2", -1.38, -3.44, .13),
        ("B1 USER", -1.49, -1.46, .15), ("B2 RESET", 1.46, -1.46, .15),
        ("MB1136", -1.88, -1.01, .18), ("REV C", -1.86, -.81, .16),
        ("LD2", .98, .30, .14), ("PWR", -1.32, .27, .13), ("LD3", -1.34, .43, .12),
        ("CN7", -3.08, 3.91, .15), ("CN6", -2.39, 2.10, .13), ("CN8", -2.39, 3.93, .14),
        ("CN10", 3.03, 3.91, .14), ("CN5", 2.40, 1.64, .13), ("CN9", 2.39, 3.92, .14),
        ("JP5", -.15, .64, .12), ("X3", .22, 3.54, .11), ("U5", -.91, 2.13, .13),
        ("www.st.com/stm32nucleo", -.81, 3.985, .14),
    ]:
        text_mesh(silks,mats,label,x,z,size)
    for name, (x,z,_) in ARDUINO.items():
        labels = {"CN5":["D15","D14","AREF","GND","D13","D12","D11","D10","D9","D8"],
                  "CN9":["D7","D6","D5","D4","D3","D2","D1","D0"],
                  "CN6":["NC","IOREF","NRST","3V3","5V","GND","GND","VIN"],
                  "CN8":["A0","A1","A2","A3","A4","A5"]}[name]
        for i,label in enumerate(labels):
            text_mesh(silks,mats,label,x-math.copysign(.322,x),z+i*PITCH+.040,.125)
    for label,x,z,y,size in [
        ("STM32",TARGET[0],TARGET[1]-.050,TOP+.161,.150),
        ("F103RBT6",TARGET[0],TARGET[1]+.138,TOP+.161,.114),
        ("STM32",ST_LINK[0],ST_LINK[1]+.066,TOP+.161,.108),
    ]:
        text_mesh(silks,mats,label,x,z,size,y,"mark")
    labels = list(silks.children)
    for obj in labels:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = labels[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "NUCLEO_TOP_SILK"
    obj.select_set(False)


def render_scene(path, top_path):
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Muted studio ambient")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.16,.20,.23,1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .46
    stage = material("Render stage","314351",0,.69)
    batch = MeshBatch()
    batch.box((0,-.16,0),(200,.15,200),stage,0)
    batch.finish("Studio only")
    for name,point,energy,size in [
        ("Main softbox",(-6,10,-6),1200,8),
        ("Front fill",(6,8,6),950,7),
        ("Rear strip",(2,6,-9),450,5),
    ]:
        light = bpy.data.lights.new(name,"AREA")
        light.energy, light.shape, light.size = energy,"DISK",size
        obj = bpy.data.objects.new(name,light)
        bpy.context.collection.objects.link(obj)
        obj.location = blender_point(point)
        aim(obj,blender_point((0,.40,0)))
    camera = bpy.data.cameras.new("Studio top oblique")
    camera.type, camera.ortho_scale = "ORTHO", 11.4
    obj = bpy.data.objects.new("Studio top oblique",camera)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((5.6,15.8,-6.7))
    aim(obj,blender_point((0,.42,0)))
    obj.rotation_euler.rotate_axis('Z',math.pi)
    scene.camera = obj
    scene.render.engine = "CYCLES"
    scene.cycles.samples,scene.cycles.use_denoising = 24,True
    def save(target, file_format):
        scene.render.image_settings.file_format = file_format
        target.parent.mkdir(parents=True,exist_ok=True)
        scene.render.filepath = str(target.resolve())
        bpy.ops.render.render(write_still=True)

    if path:
        scene.render.resolution_x, scene.render.resolution_y = 1024, 1024
        save(path, "PNG")
    if top_path:
        scene.render.resolution_x, scene.render.resolution_y = 800, 960
        camera.ortho_scale = 9.12
        obj.location = blender_point((0,15,0))
        obj.rotation_euler = (0,0,0)
        view = camera.view_frame(scene=scene)
        frame_width = max(point.x for point in view) - min(point.x for point in view)
        frame_height = max(point.y for point in view) - min(point.y for point in view)
        if not (math.isclose(frame_width,7.6,abs_tol=.0001) and math.isclose(frame_height,9.12,abs_tol=.0001)):
            raise ValueError(f"Unexpected top-view bounds: {frame_width} × {frame_height} cm")
        scene.render.image_settings.quality = 92
        save(top_path, "WEBP")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--render",type=Path)
    parser.add_argument("--top-render",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {
        "mask":material("Ivory-white solder mask","E7E5DD",.02,.47),
        "fr4":material("Exposed fiberglass edge","AA9363",.06,.62),
        "plastic":material("Black connector thermoplastic","24282C",.03,.54),
        "mold":material("Dark molded epoxy IC","25292D",.04,.66),
        "mark":material("IC laser marks","737B7C",.08,.67),
        "silk":material("Blue silkscreen ink","35536D",.01,.67),
        "tin":material("Tin leads and plated vias","ADB8BC",.78,.32),
        "gold":material("Plated header and USB contacts","C8A46A",.85,.29),
        "steel":material("Brushed connector and switch metal","BAC5C9",.87,.29),
        "solder":material("Solder fillets","929CA1",.74,.34),
        "shadow":material("Dark folded steel recesses","53636B",.64,.51),
        "usb":material("Dark USB dielectric","262A2E",0,.61),
        "ceramic":material("Ceramic and tantalum components","B69A66",.04,.55),
        "blue":material("B1 blue actuator","136ABB",.07,.29),
        "black":material("B2 black actuator","16191C",.03,.31),
        "ledbase":material("LED ceramic carrier","E0DDD0",.04,.51),
        "green":material("LD2 green lens","619739",.05,.30),
        "red":material("LD3 red lens","BD523F",.05,.32),
        "amber":material("LD1 bicolor lens unlit","D7C693",.04,.38),
    }
    root = empty("NUCLEO_COMMON")
    root["board"] = "NUCLEO-F103RB, MB1136 C-series"
    root["reference"] = MANUAL
    root["schematic"] = SCHEMATIC
    root["geometry"] = "Specified board size and connector pitch; measured layout reconstruction. Surface art and package exteriors illustrative."
    morpho,arduino = port_centres()
    make_pcb(root,mats,morpho+arduino)
    make_headers(root,mats,morpho,arduino)
    make_usb(root,mats)
    qfp(root,mats,"NUCLEO_TARGET_MCU",TARGET,1.0,16)
    qfp(root,mats,"NUCLEO_STLINK_MCU",ST_LINK,.7,12)
    pushbutton(root,mats,"NUCLEO_B1",B1,mats["blue"])
    pushbutton(root,mats,"NUCLEO_B2",B2,mats["black"])
    led(root,mats,"NUCLEO_LD1",(2.49,-3.62),mats["amber"])
    led(root,mats,"NUCLEO_LD2",LD2,mats["green"])
    led(root,mats,"NUCLEO_LD3",LD3,mats["red"])
    passives(root,mats)
    markings(root,mats)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.output.resolve()),export_format="GLB",
                              export_yup=True,export_extras=True)
    if args.render or args.top_render:
        render_scene(args.render,args.top_render)


if __name__ == "__main__":
    main()
